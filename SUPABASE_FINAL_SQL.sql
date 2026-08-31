-- Run this once after the main database setup SQL.

drop policy if exists "Participants read answers" on public.conversation_answers;
drop policy if exists "Reveal answers only after own submission" on public.conversation_answers;

-- This SECURITY DEFINER helper checks for the current user's answer without
-- recursively invoking conversation_answers RLS.
create or replace function public.has_submitted_conversation_answer(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_answers ca
    where ca.conversation_id = p_conversation_id
      and ca.user_id = p_user_id
  );
$$;

revoke all on function public.has_submitted_conversation_answer(uuid, uuid) from public;
grant execute on function public.has_submitted_conversation_answer(uuid, uuid) to authenticated;

-- Check conversation membership without conversations RLS hiding the row.
create or replace function public.is_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and (c.user_a = p_user_id or c.user_b = p_user_id)
  );
$$;

revoke all on function public.is_conversation_participant(uuid, uuid) from public;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;

-- Save an answer through a validated server-side function. This avoids client
-- write-policy edge cases while still requiring authentication and membership.
create or replace function public.submit_conversation_answer(
  p_conversation_id uuid,
  p_answer text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_answer text := btrim(p_answer);
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(clean_answer) < 3 or char_length(clean_answer) > 280 then
    raise exception 'Answer must be between 3 and 280 characters';
  end if;

  if not exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and (c.user_a = current_user_id or c.user_b = current_user_id)
      and c.status = 'active'
      and c.expires_at > now()
  ) then
    raise exception 'You are not a participant in this active conversation';
  end if;

  insert into public.conversation_answers (conversation_id, user_id, answer)
  values (p_conversation_id, current_user_id, clean_answer)
  on conflict (conversation_id, user_id)
  do update set answer = excluded.answer;
end;
$$;

revoke all on function public.submit_conversation_answer(uuid, text) from public;
grant execute on function public.submit_conversation_answer(uuid, text) to authenticated;

alter table public.messages
add column if not exists read_at timestamptz;

create or replace function public.mark_conversation_messages_read(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and (c.user_a = current_user_id or c.user_b = current_user_id)
  ) then
    raise exception 'You are not a participant in this conversation';
  end if;

  update public.messages
  set read_at = coalesce(read_at, now())
  where conversation_id = p_conversation_id
    and sender_id <> current_user_id
    and read_at is null;
end;
$$;

revoke all on function public.mark_conversation_messages_read(uuid) from public;
grant execute on function public.mark_conversation_messages_read(uuid) to authenticated;

drop policy if exists "Users submit their own answers" on public.conversation_answers;
create policy "Users submit their own answers"
on public.conversation_answers
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_conversation_participant(conversation_id, auth.uid())
);

drop policy if exists "Users update their own answers" on public.conversation_answers;
create policy "Users update their own answers"
on public.conversation_answers
for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_conversation_participant(conversation_id, auth.uid())
);

create policy "Reveal answers only after own submission"
on public.conversation_answers
for select to authenticated
using (
  public.is_conversation_participant(conversation_id, auth.uid())
  and public.has_submitted_conversation_answer(conversation_id, auth.uid())
);

create or replace function public.find_random_match(p_language text default 'en')
returns table (
  match_status text,
  conversation_id uuid,
  shared_question text,
  conversation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  candidate_id uuid;
  active_conversation record;
  new_conversation_id uuid;
  selected_question text;
  expiry_time timestamptz;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;

  select c.id, c.question, c.expires_at
  into active_conversation
  from public.conversations c
  where (c.user_a = current_user_id or c.user_b = current_user_id)
    and c.status = 'active'
    and c.expires_at > now()
  order by c.created_at desc
  limit 1;

  if active_conversation.id is not null then
    return query select 'matched'::text, active_conversation.id,
      active_conversation.question, active_conversation.expires_at;
    return;
  end if;

  delete from public.match_queue where joined_at < now() - interval '5 minutes';

  select q.user_id into candidate_id
  from public.match_queue q
  where q.user_id <> current_user_id
    and q.language = lower(trim(p_language))
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = current_user_id and b.blocked_id = q.user_id)
         or (b.blocker_id = q.user_id and b.blocked_id = current_user_id)
    )
  order by q.joined_at
  for update skip locked
  limit 1;

  if candidate_id is null then
    insert into public.match_queue(user_id, language)
    values (current_user_id, lower(trim(p_language)))
    on conflict (user_id) do update set language = excluded.language, joined_at = now();
    return query select 'waiting'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  selected_question := (array[
    'What is one small thing that made you smile today?',
    'What is something beautiful about where you live?',
    'What lesson would you share with a stranger?',
    'What is one dream you have not told many people?',
    'What makes a difficult day feel a little easier?'
  ])[1 + floor(random() * 5)::int];
  expiry_time := now() + interval '10 minutes';

  insert into public.conversations(user_a, user_b, question, expires_at)
  values (candidate_id, current_user_id, selected_question, expiry_time)
  returning id into new_conversation_id;

  delete from public.match_queue where user_id in (candidate_id, current_user_id);
  return query select 'matched'::text, new_conversation_id, selected_question, expiry_time;
end;
$$;

revoke all on function public.find_random_match(text) from public;
grant execute on function public.find_random_match(text) to authenticated;
