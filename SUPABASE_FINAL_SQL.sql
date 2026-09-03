-- Run this once after the main database setup SQL.

-- ZION end-to-end encryption identities. Public ECDH keys are discoverable by
-- signed-in users; password-wrapped private-key backups are visible only to
-- their owner. The unwrapped private key never enters Supabase.
create table if not exists public.e2ee_public_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_key jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.e2ee_public_keys enable row level security;
drop policy if exists "Signed-in users read E2EE public keys" on public.e2ee_public_keys;
create policy "Signed-in users read E2EE public keys" on public.e2ee_public_keys
for select to authenticated using (true);
drop policy if exists "Users create own E2EE public key" on public.e2ee_public_keys;
create policy "Users create own E2EE public key" on public.e2ee_public_keys
for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "Users update own E2EE public key" on public.e2ee_public_keys;
create policy "Users update own E2EE public key" on public.e2ee_public_keys
for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create table if not exists public.e2ee_key_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  key_backup jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.e2ee_key_backups enable row level security;
drop policy if exists "Users read own E2EE key backup" on public.e2ee_key_backups;
create policy "Users read own E2EE key backup" on public.e2ee_key_backups
for select to authenticated using (user_id=auth.uid());
drop policy if exists "Users create own E2EE key backup" on public.e2ee_key_backups;
create policy "Users create own E2EE key backup" on public.e2ee_key_backups
for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "Users update own E2EE key backup" on public.e2ee_key_backups;
create policy "Users update own E2EE key backup" on public.e2ee_key_backups
for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

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

  if char_length(clean_answer) < 3 or char_length(clean_answer) > 4096 then
    raise exception 'Invalid encrypted answer';
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

-- Replace legacy plaintext-length checks with room for authenticated
-- encryption envelopes. The UI still enforces the original plaintext limits.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid='public.messages'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%char_length%message%'
  loop
    execute format('alter table public.messages drop constraint %I',constraint_name);
  end loop;
end $$;
alter table public.messages drop constraint if exists messages_e2ee_length_check;
alter table public.messages add constraint messages_e2ee_length_check
check(char_length(message) between 1 and 8192);

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
      select 1 from public.conversations recent
      where recent.created_at > now() - interval '15 minutes'
        and ((recent.user_a=current_user_id and recent.user_b=q.user_id)
          or (recent.user_b=current_user_id and recent.user_a=q.user_id))
    )
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

-- Owner-only moderation role. Replace the UUID only if the owner account changes.
alter table public.profiles add column if not exists is_admin boolean not null default false;
update public.profiles
set is_admin = true
where id = 'fd62030e-f3b8-4c14-bce7-a1f3eedbb74b';

create or replace function public.is_zion_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = auth.uid() and is_admin = true); $$;
revoke all on function public.is_zion_admin() from public;
grant execute on function public.is_zion_admin() to authenticated;

drop policy if exists "Admins update all profiles" on public.profiles;
create policy "Admins update all profiles"
on public.profiles for update to authenticated
using (public.is_zion_admin())
with check (true);

revoke all on function public.find_random_match(text) from public;
grant execute on function public.find_random_match(text) to authenticated;

-- End a random conversation safely and notify the other participant through
-- the shared conversation status. Both participants can then choose Next.
create or replace function public.leave_random_conversation(
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.conversations
  set status = 'ended'
  where id = p_conversation_id
    and status = 'active'
    and (user_a = auth.uid() or user_b = auth.uid());
  if not found then raise exception 'Active conversation not found'; end if;
end;
$$;
revoke all on function public.leave_random_conversation(uuid) from public;
grant execute on function public.leave_random_conversation(uuid) to authenticated;

-- ZION profiles, permanent friends, pinned friends and private friend chat.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 24),
  gender text not null check (gender in ('male', 'female', 'other')),
  country text not null check (char_length(country) between 2 and 60),
  avatar text not null default 'avatar-1',
  is_banned boolean not null default false,
  ban_reason text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "Authenticated users view profiles" on public.profiles;
create policy "Authenticated users view profiles" on public.profiles
for select to authenticated using (true);
drop policy if exists "Users create own profile" on public.profiles;
create policy "Users create own profile" on public.profiles
for insert to authenticated with check (id = auth.uid());
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

alter table public.friendships enable row level security;
drop policy if exists "Members view friendships" on public.friendships;
create policy "Members view friendships" on public.friendships
for select to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "Users request friendship" on public.friendships;
create policy "Users request friendship" on public.friendships
for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists "Addressee updates friendship" on public.friendships;
create policy "Addressee updates friendship" on public.friendships
for update to authenticated using (addressee_id = auth.uid()) with check (addressee_id = auth.uid());

create table if not exists public.friend_pins (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);
alter table public.friend_pins enable row level security;
drop policy if exists "Users manage own pins" on public.friend_pins;
create policy "Users manage own pins" on public.friend_pins
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.is_friendship_member(p_friendship_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.id = p_friendship_id and f.status = 'accepted'
      and (f.requester_id = p_user_id or f.addressee_id = p_user_id)
  );
$$;
revoke all on function public.is_friendship_member(uuid, uuid) from public;
grant execute on function public.is_friendship_member(uuid, uuid) to authenticated;

create or replace function public.request_zion_friend(p_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null or p_user_id = current_user_id then raise exception 'Invalid friend request'; end if;
  if exists (select 1 from public.profiles p where p.id = current_user_id and p.is_banned) then raise exception 'Account is banned'; end if;
  if exists (select 1 from public.user_blocks b where (b.blocker_id=current_user_id and b.blocked_id=p_user_id) or (b.blocker_id=p_user_id and b.blocked_id=current_user_id)) then raise exception 'Friend request unavailable'; end if;
  update public.friendships set status='accepted', accepted_at=now()
  where requester_id=p_user_id and addressee_id=current_user_id and status='pending';
  if found then return 'accepted'; end if;
  insert into public.friendships(requester_id, addressee_id)
  values(current_user_id, p_user_id)
  on conflict(requester_id, addressee_id) do update set status=case when public.friendships.status='declined' then 'pending' else public.friendships.status end;
  return 'requested';
end; $$;
revoke all on function public.request_zion_friend(uuid) from public;
grant execute on function public.request_zion_friend(uuid) to authenticated;

create or replace function public.remove_zion_friend(p_friendship_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.friendships f where f.id=p_friendship_id
    and (f.requester_id=current_user_id or f.addressee_id=current_user_id))
    then raise exception 'Friendship not found';
  end if;
  delete from public.friend_pins where user_id=current_user_id and friend_id in (
    select case when f.requester_id=current_user_id then f.addressee_id else f.requester_id end
    from public.friendships f where f.id=p_friendship_id
  );
  delete from public.friendships where id=p_friendship_id;
end; $$;
revoke all on function public.remove_zion_friend(uuid) from public;
grant execute on function public.remove_zion_friend(uuid) to authenticated;

create table if not exists public.friend_messages (
  id bigint generated by default as identity primary key,
  friendship_id uuid not null references public.friendships(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text,
  media_path text,
  media_type text check (media_type is null or media_type in ('image','video')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check ((message is not null and char_length(message) between 1 and 1000) or media_path is not null)
);
-- Encrypted envelopes are larger than their plaintext (IV, tag and Base64).
alter table public.friend_messages drop constraint if exists friend_messages_check;
alter table public.friend_messages add constraint friend_messages_check
check ((message is not null and char_length(message) between 1 and 8192) or media_path is not null);
alter table public.friend_messages add column if not exists edited_at timestamptz;
alter table public.friend_messages add column if not exists deleted_at timestamptz;
alter table public.friend_messages add column if not exists reply_to_id bigint;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='friend_messages_reply_to_id_fkey') then
    alter table public.friend_messages add constraint friend_messages_reply_to_id_fkey
    foreign key(reply_to_id) references public.friend_messages(id) on delete set null;
  end if;
end $$;
alter table public.friend_messages enable row level security;
drop policy if exists "Friends read messages" on public.friend_messages;
create policy "Friends read messages" on public.friend_messages
for select to authenticated using (public.is_friendship_member(friendship_id, auth.uid()));
drop policy if exists "Friends send messages" on public.friend_messages;
create policy "Friends send messages" on public.friend_messages
for insert to authenticated with check (sender_id=auth.uid() and public.is_friendship_member(friendship_id, auth.uid()));

create or replace function public.mark_friend_messages_read(p_friendship_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid();
begin
  if not public.is_friendship_member(p_friendship_id, current_user_id) then raise exception 'Not friends'; end if;
  update public.friend_messages set read_at=coalesce(read_at,now())
  where friendship_id=p_friendship_id and sender_id<>current_user_id and read_at is null;
end; $$;
revoke all on function public.mark_friend_messages_read(uuid) from public;
grant execute on function public.mark_friend_messages_read(uuid) to authenticated;

create or replace function public.edit_friend_message(p_message_id bigint,p_message text)
returns void language plpgsql security definer set search_path='' as $$
declare clean_message text:=btrim(p_message);
begin
  if auth.uid() is null or char_length(clean_message)<1 or char_length(clean_message)>8192 then raise exception 'Invalid message'; end if;
  update public.friend_messages set message=clean_message,edited_at=now()
  where id=p_message_id and sender_id=auth.uid() and deleted_at is null and media_path is null;
  if not found then raise exception 'Message cannot be edited'; end if;
end $$;
revoke all on function public.edit_friend_message(bigint,text) from public;
grant execute on function public.edit_friend_message(bigint,text) to authenticated;

create or replace function public.delete_friend_message(p_message_id bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.friend_messages
  set message='Message deleted',media_path=null,media_type=null,deleted_at=now(),edited_at=null
  where id=p_message_id and sender_id=auth.uid() and deleted_at is null;
  if not found then raise exception 'Message cannot be deleted'; end if;
end $$;
revoke all on function public.delete_friend_message(bigint) from public;
grant execute on function public.delete_friend_message(bigint) to authenticated;

alter table public.messages add column if not exists media_path text;
alter table public.messages add column if not exists media_type text
check (media_type is null or media_type in ('image','video'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media','chat-media',false,262144000,array['application/octet-stream','image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public=false, file_size_limit=262144000,
allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Authenticated upload chat media" on storage.objects;
create policy "Authenticated upload chat media" on storage.objects
for insert to authenticated with check (
  bucket_id='chat-media' and (storage.foldername(name))[3]=auth.uid()::text
  and (
    ((storage.foldername(name))[1]='random' and public.is_conversation_participant(((storage.foldername(name))[2])::uuid,auth.uid()))
    or ((storage.foldername(name))[1]='friend' and public.is_friendship_member(((storage.foldername(name))[2])::uuid,auth.uid()))
  )
);
drop policy if exists "Participants view chat media" on storage.objects;
create policy "Participants view chat media" on storage.objects
for select to authenticated using (
  bucket_id='chat-media' and (
    ((storage.foldername(name))[1]='random' and public.is_conversation_participant(((storage.foldername(name))[2])::uuid,auth.uid()))
    or ((storage.foldername(name))[1]='friend' and public.is_friendship_member(((storage.foldername(name))[2])::uuid,auth.uid()))
  )
);

-- ZION streaks, profile privacy and permission-based friend audio calls.
alter table public.friendships add column if not exists streak_count integer not null default 0;
alter table public.friendships add column if not exists last_streak_date date;
alter table public.profiles add column if not exists allow_audio_calls boolean not null default true;
alter table public.profiles add column if not exists show_country boolean not null default true;
alter table public.profiles add column if not exists show_online_status boolean not null default true;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists profile_edit_used boolean not null default false;

-- Followers are separate from mutual friendships. A user may follow or
-- unfollow another profile without gaining access to private chats.
create table if not exists public.profile_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id),
  check(follower_id<>following_id)
);
alter table public.profile_follows enable row level security;
drop policy if exists "Signed-in users view follows" on public.profile_follows;
create policy "Signed-in users view follows" on public.profile_follows
for select to authenticated using(true);
drop policy if exists "Users follow profiles" on public.profile_follows;
create policy "Users follow profiles" on public.profile_follows
for insert to authenticated with check(follower_id=auth.uid());
drop policy if exists "Users unfollow profiles" on public.profile_follows;
create policy "Users unfollow profiles" on public.profile_follows
for delete to authenticated using(follower_id=auth.uid());

-- End-to-end encrypted communities. Supabase stores ciphertext and a separate
-- copy of the group key encrypted for each member; it never receives the raw
-- group key.
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(name) between 3 and 60),
  created_at timestamptz not null default now()
);
create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check(role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  primary key(community_id,user_id)
);
create or replace function public.is_community_member(p_community_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.community_members m where m.community_id=p_community_id and m.user_id=p_user_id)
$$;
revoke all on function public.is_community_member(uuid,uuid) from public;
grant execute on function public.is_community_member(uuid,uuid) to authenticated;
create or replace function public.is_community_owner(p_community_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.communities c where c.id=p_community_id and c.owner_id=p_user_id)
$$;
revoke all on function public.is_community_owner(uuid,uuid) from public;
grant execute on function public.is_community_owner(uuid,uuid) to authenticated;

create or replace function public.create_zion_community(p_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid; clean_name text:=btrim(p_name);
begin
  if auth.uid() is null or char_length(clean_name)<3 or char_length(clean_name)>60 then raise exception 'Invalid community name'; end if;
  insert into public.communities(owner_id,name) values(auth.uid(),clean_name) returning id into new_id;
  insert into public.community_members(community_id,user_id,role) values(new_id,auth.uid(),'owner');
  return new_id;
end $$;
revoke all on function public.create_zion_community(text) from public;
grant execute on function public.create_zion_community(text) to authenticated;

alter table public.communities enable row level security;
drop policy if exists "Members view communities" on public.communities;
create policy "Members view communities" on public.communities for select to authenticated
using(public.is_community_member(id,auth.uid()));
drop policy if exists "Users create communities" on public.communities;
create policy "Users create communities" on public.communities for insert to authenticated
with check(owner_id=auth.uid());

alter table public.community_members enable row level security;
drop policy if exists "Members view community members" on public.community_members;
create policy "Members view community members" on public.community_members for select to authenticated
using(public.is_community_member(community_id,auth.uid()));
drop policy if exists "Owners add community members" on public.community_members;
create policy "Owners add community members" on public.community_members for insert to authenticated
with check(public.is_community_owner(community_id,auth.uid()));

create table if not exists public.community_member_keys (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wrapped_by uuid not null references auth.users(id) on delete cascade,
  key_version integer not null default 1,
  encrypted_key text not null,
  created_at timestamptz not null default now(),
  primary key(community_id,user_id,key_version)
);
alter table public.community_member_keys enable row level security;
drop policy if exists "Members read own community key" on public.community_member_keys;
create policy "Members read own community key" on public.community_member_keys for select to authenticated
using(user_id=auth.uid() and public.is_community_member(community_id,auth.uid()));
drop policy if exists "Owners distribute community keys" on public.community_member_keys;
create policy "Owners distribute community keys" on public.community_member_keys for insert to authenticated
with check(wrapped_by=auth.uid() and public.is_community_owner(community_id,auth.uid()));

create table if not exists public.community_messages (
  id bigint generated by default as identity primary key,
  community_id uuid not null references public.communities(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  ciphertext text not null check(char_length(ciphertext) between 1 and 16384),
  media_path text,
  media_type text check(media_type is null or media_type in ('image','video')),
  key_version integer not null default 1,
  created_at timestamptz not null default now()
);
alter table public.community_messages add column if not exists media_path text;
alter table public.community_messages add column if not exists media_type text
check(media_type is null or media_type in ('image','video'));
alter table public.community_messages enable row level security;
drop policy if exists "Members read community ciphertext" on public.community_messages;
create policy "Members read community ciphertext" on public.community_messages for select to authenticated
using(public.is_community_member(community_id,auth.uid()));
drop policy if exists "Members send community ciphertext" on public.community_messages;
create policy "Members send community ciphertext" on public.community_messages for insert to authenticated
with check(sender_id=auth.uid() and public.is_community_member(community_id,auth.uid()));

drop policy if exists "Community members upload encrypted media" on storage.objects;
create policy "Community members upload encrypted media" on storage.objects
for insert to authenticated with check(
  bucket_id='chat-media'
  and (storage.foldername(name))[1]='community'
  and (storage.foldername(name))[3]=auth.uid()::text
  and public.is_community_member(((storage.foldername(name))[2])::uuid,auth.uid())
);
drop policy if exists "Community members read encrypted media" on storage.objects;
create policy "Community members read encrypted media" on storage.objects
for select to authenticated using(
  bucket_id='chat-media'
  and (storage.foldername(name))[1]='community'
  and public.is_community_member(((storage.foldername(name))[2])::uuid,auth.uid())
);

-- Private Broadcast/Presence authorization for random rooms and friend calls.
-- Keep every client channel configured with private:true.
drop policy if exists "ZION participants receive private realtime" on realtime.messages;
create policy "ZION participants receive private realtime" on realtime.messages
for select to authenticated using (
  case
    when realtime.topic() ~ '^friend-live-[0-9a-f-]{36}$' then
      public.is_friendship_member(substring(realtime.topic() from 13)::uuid,auth.uid())
    when realtime.topic() ~ '^random-room-[0-9a-f-]{36}$' then
      public.is_conversation_participant(substring(realtime.topic() from 13)::uuid,auth.uid())
    else false
  end
);
drop policy if exists "ZION participants send private realtime" on realtime.messages;
create policy "ZION participants send private realtime" on realtime.messages
for insert to authenticated with check (
  case
    when realtime.topic() ~ '^friend-live-[0-9a-f-]{36}$' then
      public.is_friendship_member(substring(realtime.topic() from 13)::uuid,auth.uid())
    when realtime.topic() ~ '^random-room-[0-9a-f-]{36}$' then
      public.is_conversation_participant(substring(realtime.topic() from 13)::uuid,auth.uid())
    else false
  end
);

create or replace function public.enforce_profile_edit_once()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.profile_edit_used and (new.username is distinct from old.username or new.country is distinct from old.country) then
    raise exception 'Username and country can only be changed once';
  end if;
  if new.username is distinct from old.username or new.country is distinct from old.country then
    new.profile_edit_used:=true;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_one_time_edit on public.profiles;
create trigger profiles_one_time_edit before update on public.profiles
for each row execute function public.enforce_profile_edit_once();

create or replace function public.update_profile_once(p_username text,p_country text)
returns void language plpgsql security definer set search_path='' as $$
declare clean_username text:=btrim(p_username); clean_country text:=btrim(p_country);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(clean_username) not between 3 and 24 or char_length(clean_country) not between 2 and 60 then raise exception 'Invalid profile details'; end if;
  update public.profiles set username=clean_username,country=clean_country,profile_edit_used=true
  where id=auth.uid() and profile_edit_used=false;
  if not found then raise exception 'Profile details can only be changed once'; end if;
exception when unique_violation then raise exception 'That username is already taken';
end; $$;
revoke all on function public.update_profile_once(text,text) from public;
grant execute on function public.update_profile_once(text,text) to authenticated;

-- Usernames are unique even when letter casing differs. PostgreSQL text and
-- char_length support Malayalam, Arabic, Hindi and other Unicode scripts.
create unique index if not exists profiles_username_lower_unique
on public.profiles (lower(username));

create or replace function public.find_zion_user(p_username text)
returns table (
  id uuid, username text, gender text, country text, avatar text,
  avatar_url text, created_at timestamptz, friend_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,p.username,p.gender,
    case when p.show_country then p.country else '' end,
    p.avatar,p.avatar_url,p.created_at,
    coalesce((select f.status from public.friendships f
      where (f.requester_id=auth.uid() and f.addressee_id=p.id)
         or (f.requester_id=p.id and f.addressee_id=auth.uid())
      order by f.created_at desc limit 1),'none')
  from public.profiles p
  where lower(p.username)=lower(btrim(p_username))
    and p.id<>auth.uid() and not p.is_banned
  limit 1;
$$;
revoke all on function public.find_zion_user(text) from public;
grant execute on function public.find_zion_user(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Users upload own profile photo" on storage.objects;
create policy "Users upload own profile photo" on storage.objects for insert to authenticated
with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users update own profile photo" on storage.objects;
create policy "Users update own profile photo" on storage.objects for update to authenticated
using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Public view profile photos" on storage.objects;
create policy "Public view profile photos" on storage.objects for select to public
using(bucket_id='profile-avatars');

create or replace function public.update_friend_media_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_date date;
begin
  if new.media_type not in ('image','video') then return new; end if;
  select last_streak_date into previous_date from public.friendships where id=new.friendship_id for update;
  if previous_date=current_date then return new; end if;
  update public.friendships
  -- Keep the streak through a short break. Restart only after three complete
  -- consecutive days without a new photo/video streak event.
  set streak_count=case when previous_date>=current_date-3 then streak_count+1 else 1 end,
      last_streak_date=current_date
  where id=new.friendship_id;
  return new;
end;
$$;

drop trigger if exists friend_media_streak_trigger on public.friend_messages;
create trigger friend_media_streak_trigger
after insert on public.friend_messages
for each row execute function public.update_friend_media_streak();

create table if not exists public.friend_calls (
  id uuid primary key default gen_random_uuid(),
  friendship_id uuid not null references public.friendships(id) on delete cascade,
  caller_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ringing' check(status in ('ringing','accepted','declined','ended','missed')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
alter table public.friend_calls enable row level security;
drop policy if exists "Call members view calls" on public.friend_calls;
create policy "Call members view calls" on public.friend_calls for select to authenticated
using(caller_id=auth.uid() or receiver_id=auth.uid());
drop policy if exists "Friends request calls" on public.friend_calls;
create policy "Friends request calls" on public.friend_calls for insert to authenticated
with check(caller_id=auth.uid() and public.is_friendship_member(friendship_id,auth.uid()));
drop policy if exists "Call members update calls" on public.friend_calls;
create policy "Call members update calls" on public.friend_calls for update to authenticated
using(caller_id=auth.uid() or receiver_id=auth.uid())
with check(caller_id=auth.uid() or receiver_id=auth.uid());

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_calls') then
    alter publication supabase_realtime add table public.friend_calls;
  end if;
end $$;

-- Deliver live friend-request events to logged-in ZION clients.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friendships') then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;

-- Realtime events replace high-frequency browser polling.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'messages','conversation_answers','conversations','friend_messages',
    'community_messages'
  ]
  loop
    if not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename=table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
end $$;
