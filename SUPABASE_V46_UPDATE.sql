-- Run once after the earlier ZION SQL migrations.
alter table public.friend_messages
  add column if not exists hidden_for uuid[] not null default '{}'::uuid[];

create or replace function public.hide_friend_message_for_me(p_message_id bigint)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare changed integer;
begin
  update public.friend_messages m
  set hidden_for=array(select distinct value from unnest(m.hidden_for || auth.uid()) value)
  where m.id=p_message_id
    and public.is_friendship_member(m.friendship_id,auth.uid());
  get diagnostics changed=row_count;
  return changed=1;
end;
$$;
revoke all on function public.hide_friend_message_for_me(bigint) from public;
grant execute on function public.hide_friend_message_for_me(bigint) to authenticated;

-- Keep exactly one unread follow-request notification per sender/recipient.
delete from public.zion_notifications older
using public.zion_notifications newer
where older.id<newer.id
  and older.recipient_id=newer.recipient_id
  and older.actor_id=newer.actor_id
  and older.kind='profile_follow_request'
  and newer.kind='profile_follow_request'
  and older.read_at is null
  and newer.read_at is null;

create unique index if not exists zion_one_pending_follow_notice
on public.zion_notifications(recipient_id,actor_id,kind)
where kind='profile_follow_request' and read_at is null;

create or replace function public.request_zion_follow(p_target_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare req uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_target_id=auth.uid() then raise exception 'Cannot follow yourself'; end if;
  if exists(select 1 from public.profile_follows where follower_id=auth.uid() and following_id=p_target_id) then
    return 'following';
  end if;
  insert into public.profile_follow_requests(requester_id,target_id,status)
  values(auth.uid(),p_target_id,'pending')
  on conflict(requester_id,target_id) do update
    set status=case when public.profile_follow_requests.status='pending' then 'pending' else excluded.status end
  returning id into req;
  insert into public.zion_notifications(recipient_id,actor_id,kind,follow_request_id)
  values(p_target_id,auth.uid(),'profile_follow_request',req)
  on conflict(recipient_id,actor_id,kind)
    where kind='profile_follow_request' and read_at is null
  do update set follow_request_id=excluded.follow_request_id;
  return 'pending';
end;
$$;
revoke all on function public.request_zion_follow(uuid) from public;
grant execute on function public.request_zion_follow(uuid) to authenticated;
