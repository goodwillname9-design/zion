-- Requires existing V57 security schema. No private message content is exposed to CEO.
begin;
create or replace function public.is_zion_once_object(p_name text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from public.friend_messages where media_path=p_name and view_once)$$;
revoke all on function public.is_zion_once_object(text) from public,anon;
grant execute on function public.is_zion_once_object(text) to authenticated;
drop policy if exists "View once requires server delivery" on storage.objects;
create policy "View once requires server delivery" on storage.objects as restrictive for select to authenticated using(bucket_id<>'chat-media' or not public.is_zion_once_object(name));
create or replace function public.claim_zion_once(p_id bigint) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare path text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and not coalesce(is_banned,false)) then raise exception 'Active login required';end if;
 update public.friend_messages m set viewed_at=now() where m.id=p_id and m.view_once and m.viewed_at is null and m.sender_id<>auth.uid() and public.is_friendship_member(m.friendship_id,auth.uid())
 and exists(select 1 from storage.objects o where o.bucket_id='chat-media' and o.name=m.media_path and (o.metadata->>'size')::bigint<=4194304)
 returning m.media_path into path;
 if path is null then raise exception 'Media already opened, unavailable or larger than 4 MB';end if;
 return path;
end $$;
revoke all on function public.claim_zion_once(bigint) from public,anon;
grant execute on function public.claim_zion_once(bigint) to authenticated;
create table if not exists public.zion_device_sessions(user_id uuid references public.profiles(id) on delete cascade,session_key text not null,user_agent text not null,first_seen timestamptz not null default now(),last_seen timestamptz not null default now(),primary key(user_id,session_key));
alter table public.zion_device_sessions enable row level security;
revoke all on public.zion_device_sessions from anon,authenticated;
create or replace function public.zion_note_device(p_agent text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare sid text:=auth.jwt()->>'session_id';
begin
 if auth.uid() is null or sid is null then return;end if;
 insert into public.zion_device_sessions(user_id,session_key,user_agent) values(auth.uid(),sid,left(coalesce(p_agent,'Unknown browser'),400)) on conflict(user_id,session_key) do update set last_seen=now(),user_agent=excluded.user_agent;
end $$;
create or replace function public.zion_ceo_devices() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid()<>'fd62030e-f3b8-4c14-bce7-a1f3eedbb74b'::uuid or auth.uid() is null then raise exception 'CEO only';end if;
 return coalesce((select jsonb_agg(to_jsonb(r)) from (select p.username,s.user_agent,s.first_seen,s.last_seen from public.zion_device_sessions s join public.profiles p on p.id=s.user_id order by s.last_seen desc limit 200) r),'[]'::jsonb);
end $$;
revoke all on function public.zion_note_device(text),public.zion_ceo_devices() from public,anon;
grant execute on function public.zion_note_device(text),public.zion_ceo_devices() to authenticated;
commit;
