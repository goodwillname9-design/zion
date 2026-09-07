-- ZION V57 security/stability migration. Run once in Supabase SQL Editor.
-- Depends on SUPABASE_FINAL_SQL.sql and V42/V46/V50 migrations.

-- The owner role is tied to the immutable auth UUID, never to a client-editable flag.
update public.profiles
set is_admin = (id = 'fd62030e-f3b8-4c14-bce7-a1f3eedbb74b'::uuid);

create or replace function public.is_zion_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() = 'fd62030e-f3b8-4c14-bce7-a1f3eedbb74b'::uuid; $$;
revoke all on function public.is_zion_admin() from public;
grant execute on function public.is_zion_admin() to authenticated;

create or replace function public.protect_zion_profile_security_fields()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() <> 'fd62030e-f3b8-4c14-bce7-a1f3eedbb74b'::uuid then
    new.is_admin := old.is_admin;
    new.is_banned := old.is_banned;
    new.ban_reason := old.ban_reason;
    new.follower_base_count := old.follower_base_count;
  end if;
  return new;
end; $$;
drop trigger if exists protect_zion_profile_security_fields on public.profiles;
create trigger protect_zion_profile_security_fields
before update on public.profiles for each row
execute function public.protect_zion_profile_security_fields();

create or replace function public.moderate_zion_profile(
  p_target_id uuid, p_banned boolean, p_reason text default null
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_zion_admin() then raise exception 'Owner access required'; end if;
  if p_target_id=auth.uid() then raise exception 'Owner account cannot be suspended'; end if;
  update public.profiles
  set is_banned=p_banned,
      ban_reason=case when p_banned then left(coalesce(nullif(btrim(p_reason),''),'Community safety violation'),300) else null end
  where id=p_target_id;
  if not found then raise exception 'Profile not found'; end if;
end; $$;
revoke all on function public.moderate_zion_profile(uuid,boolean,text) from public;
grant execute on function public.moderate_zion_profile(uuid,boolean,text) to authenticated;

-- Remove historical unread duplicates and prevent them from returning.
delete from public.zion_notifications old
using public.zion_notifications newer
where old.id < newer.id and old.read_at is null and newer.read_at is null
  and old.recipient_id=newer.recipient_id and old.actor_id=newer.actor_id
  and old.kind=newer.kind and coalesce(old.reel_id,'00000000-0000-0000-0000-000000000000'::uuid)=coalesce(newer.reel_id,'00000000-0000-0000-0000-000000000000'::uuid);
create unique index if not exists zion_one_unread_activity_notice
on public.zion_notifications(recipient_id,actor_id,kind,coalesce(reel_id,'00000000-0000-0000-0000-000000000000'::uuid))
where read_at is null and kind in ('reel_like','profile_follow','story_like');

create or replace function public.mark_all_zion_notifications_read()
returns integer language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  update public.zion_notifications set read_at=now()
  where recipient_id=auth.uid() and read_at is null;
  get diagnostics changed=row_count;
  return changed;
end; $$;
revoke all on function public.mark_all_zion_notifications_read() from public;
grant execute on function public.mark_all_zion_notifications_read() to authenticated;

-- A consumed view-once object cannot receive another signed URL through RLS.
create or replace function public.can_read_zion_chat_object(p_name text,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select
    case
      when (storage.foldername(p_name))[1]='random' then
        public.is_conversation_participant(((storage.foldername(p_name))[2])::uuid,p_user)
      when (storage.foldername(p_name))[1]='friend' then
        public.is_friendship_member(((storage.foldername(p_name))[2])::uuid,p_user)
        and not exists(
          select 1 from public.friend_messages m
          where m.media_path=p_name and m.view_once and m.viewed_at is not null
        )
      when (storage.foldername(p_name))[1] in ('reels','stories') then true
      else false
    end;
$$;
revoke all on function public.can_read_zion_chat_object(text,uuid) from public;
grant execute on function public.can_read_zion_chat_object(text,uuid) to authenticated;

drop policy if exists "Participants view chat media" on storage.objects;
create policy "Participants view chat media" on storage.objects
for select to authenticated using(
  bucket_id='chat-media' and public.can_read_zion_chat_object(name,auth.uid())
);

-- Server-side anti-spam limits for the highest-volume user actions.
create or replace function public.limit_friend_message_rate()
returns trigger language plpgsql set search_path='' as $$
begin
  if (select count(*) from public.friend_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute') >= 60
  then raise exception 'Please slow down and try again shortly'; end if;
  return new;
end; $$;
drop trigger if exists limit_friend_message_rate on public.friend_messages;
create trigger limit_friend_message_rate before insert on public.friend_messages
for each row execute function public.limit_friend_message_rate();

create or replace function public.limit_reel_comment_rate()
returns trigger language plpgsql set search_path='' as $$
begin
  if (select count(*) from public.zion_reel_comments where user_id=auth.uid() and created_at>now()-interval '1 minute') >= 20
  then raise exception 'Please slow down and try again shortly'; end if;
  return new;
end; $$;
drop trigger if exists limit_reel_comment_rate on public.zion_reel_comments;
create trigger limit_reel_comment_rate before insert on public.zion_reel_comments
for each row execute function public.limit_reel_comment_rate();

create index if not exists friend_messages_room_recent_idx on public.friend_messages(friendship_id,created_at desc);
create index if not exists friend_messages_unread_idx on public.friend_messages(sender_id,read_at) where read_at is null;
create index if not exists zion_reels_recent_idx on public.zion_reels(created_at desc);
create index if not exists zion_stories_expiry_idx on public.zion_stories(expires_at);
create index if not exists zion_notifications_unread_idx on public.zion_notifications(recipient_id,created_at desc) where read_at is null;

-- Minimal client error telemetry. Never store chat/message/media contents here.
create table if not exists public.zion_error_logs(
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  error_code text not null check(char_length(error_code) between 1 and 80),
  route text not null default '/',
  created_at timestamptz not null default now()
);
alter table public.zion_error_logs enable row level security;
drop policy if exists "Users log own app errors" on public.zion_error_logs;
create policy "Users log own app errors" on public.zion_error_logs for insert to authenticated
with check(user_id=auth.uid());
drop policy if exists "Owner reads app errors" on public.zion_error_logs;
create policy "Owner reads app errors" on public.zion_error_logs for select to authenticated
using(public.is_zion_admin());

-- Old error logs are not personal analytics and are retained for only 30 days.
create or replace function public.cleanup_zion_operational_data()
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.zion_error_logs where created_at < now()-interval '30 days';
  delete from public.zion_stories where expires_at <= now();
end; $$;
revoke all on function public.cleanup_zion_operational_data() from public;
grant execute on function public.cleanup_zion_operational_data() to authenticated;
