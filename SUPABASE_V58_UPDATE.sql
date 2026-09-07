-- ZION V58: secure screenshot-attempt notices. Run after V57.
alter table public.zion_notifications drop constraint if exists zion_notifications_kind_check;
alter table public.zion_notifications add constraint zion_notifications_kind_check
check(kind in ('reel_like','reel_comment','profile_follow','profile_follow_request','story_like','screenshot_attempt'));

create or replace function public.notify_chat_screenshot_attempt(p_friendship_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
  select case when requester_id=auth.uid() then addressee_id else requester_id end
  into recipient from public.friendships
  where id=p_friendship_id and status='accepted'
    and auth.uid() in (requester_id,addressee_id);
  if recipient is null then raise exception 'Friend chat access required'; end if;
  if exists(select 1 from public.zion_notifications
    where recipient_id=recipient and actor_id=auth.uid() and kind='screenshot_attempt'
      and created_at>now()-interval '30 seconds') then return; end if;
  insert into public.zion_notifications(recipient_id,actor_id,kind)
  values(recipient,auth.uid(),'screenshot_attempt');
end; $$;
revoke all on function public.notify_chat_screenshot_attempt(uuid) from public;
grant execute on function public.notify_chat_screenshot_attempt(uuid) to authenticated;
