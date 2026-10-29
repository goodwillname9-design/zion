-- ZION V81 — "Online now" is visible to the CEO account only.
-- Run once in Supabase SQL Editor. Safe to re-run. No data is deleted.
begin;

-- Every active account reports presence (heartbeat) but is told nothing back.
create or replace function public.zion_online_ping() returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and not coalesce(is_banned,false)) then
  raise exception 'Active account required';
 end if;
 insert into public.zion_online_presence(user_id,seen_at) values(uid,now())
 on conflict(user_id) do update set seen_at=excluded.seen_at;
end $$;
revoke all on function public.zion_online_ping() from public,anon;
grant execute on function public.zion_online_ping() to authenticated;

-- Only the CEO can read the number. Everyone else gets an error (and the UI shows nothing).
create or replace function public.zion_online_count() returns bigint
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();result bigint;
begin
 if uid is null or uid<>'fd62030e-f3b8-4c14-bce7-a1f3eedbb74b'::uuid then
  raise exception 'CEO only';
 end if;
 insert into public.zion_online_presence(user_id,seen_at) values(uid,now())
 on conflict(user_id) do update set seen_at=excluded.seen_at;
 select count(*) into result from public.zion_online_presence p
 join public.profiles a on a.id=p.user_id
 where p.seen_at>now()-interval '90 seconds' and not coalesce(a.is_banned,false);
 return result;
end $$;
revoke all on function public.zion_online_count() from public,anon;
grant execute on function public.zion_online_count() to authenticated;

commit;
