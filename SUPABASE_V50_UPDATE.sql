-- ZION V50: Instagram-style public/private profiles.
alter table public.profiles
  add column if not exists is_private boolean not null default false;

create or replace function public.request_zion_follow(p_target_id uuid)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  req uuid;
  target_private boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_target_id=auth.uid() then raise exception 'Cannot follow yourself'; end if;
  if exists(select 1 from public.profile_follows where follower_id=auth.uid() and following_id=p_target_id) then
    return 'following';
  end if;

  select coalesce(is_private,false) into target_private
  from public.profiles where id=p_target_id;

  if not target_private then
    insert into public.profile_follows(follower_id,following_id)
    values(auth.uid(),p_target_id) on conflict do nothing;
    return 'following';
  end if;

  insert into public.profile_follow_requests(requester_id,target_id,status)
  values(auth.uid(),p_target_id,'pending')
  on conflict(requester_id,target_id) do update
    set status='pending',created_at=now()
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
