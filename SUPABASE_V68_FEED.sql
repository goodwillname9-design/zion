-- Run after V67 feed migration.
begin;
create table if not exists public.zion_feed_comments(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.zion_feed_posts(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,body text not null check(length(btrim(body)) between 1 and 1000),created_at timestamptz not null default now());
create index if not exists zion_feed_comments_page on public.zion_feed_comments(post_id,created_at desc);
create table if not exists public.zion_feed_reports(post_id uuid references public.zion_feed_posts(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,reason text not null check(length(btrim(reason)) between 1 and 1000),created_at timestamptz not null default now(),primary key(post_id,user_id));
alter table public.zion_feed_comments enable row level security;
alter table public.zion_feed_reports enable row level security;
revoke all on public.zion_feed_comments,public.zion_feed_reports from anon,authenticated;
create or replace function public.zion_feed_discuss(p_post uuid,p_action text,p_body text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.zion_feed_active() then raise exception 'Active login required';end if;
 if p_action='reports' then
  if not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then raise exception 'Admin access required';end if;
  return coalesce((select jsonb_agg(to_jsonb(r)) from (select p.id,p.body,a.username, count(*) as reports from public.zion_feed_reports r join public.zion_feed_posts p on p.id=r.post_id join public.profiles a on a.id=p.owner_id group by p.id,a.username order by count(*) desc limit 50) r),'[]'::jsonb);
 end if;
 if not exists(select 1 from public.zion_feed_posts p join public.profiles a on a.id=p.owner_id where p.id=p_post and not coalesce(a.is_banned,false)) then raise exception 'Post unavailable';end if;
 if p_action in ('comment','report') then
  if p_body is null or length(btrim(p_body)) not between 1 and 1000 then raise exception 'Enter 1–1000 characters';end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,68));
  if p_action='comment' then
   if exists(select 1 from public.zion_feed_comments where user_id=auth.uid() and created_at>now()-interval '5 seconds') then raise exception 'Wait 5 seconds between comments';end if;
   insert into public.zion_feed_comments(post_id,user_id,body) values(p_post,auth.uid(),btrim(p_body));
  else insert into public.zion_feed_reports(post_id,user_id,reason) values(p_post,auth.uid(),btrim(p_body)) on conflict(post_id,user_id) do update set reason=excluded.reason;return jsonb_build_object('reported',true);end if;
 elsif p_action<>'list' or p_action is null then raise exception 'Unknown action';end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from (select c.id,c.body,c.created_at,a.username from public.zion_feed_comments c join public.profiles a on a.id=c.user_id where c.post_id=p_post and not coalesce(a.is_banned,false) order by c.created_at desc,c.id desc limit 50) r),'[]'::jsonb);
end $$;
revoke all on function public.zion_feed_discuss(uuid,text,text) from public,anon;
grant execute on function public.zion_feed_discuss(uuid,text,text) to authenticated;
commit;
