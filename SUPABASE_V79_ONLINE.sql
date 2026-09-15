begin;
create table if not exists public.zion_online_presence (
 user_id uuid primary key references auth.users(id) on delete cascade,
 seen_at timestamptz not null default now()
);
alter table public.zion_online_presence enable row level security;
revoke all on public.zion_online_presence from anon, authenticated;
create index if not exists zion_online_presence_seen_idx on public.zion_online_presence(seen_at);
create or replace function public.zion_online_count() returns bigint
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();result bigint;
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and not coalesce(is_banned,false)) then
  raise exception 'Active account required';
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
