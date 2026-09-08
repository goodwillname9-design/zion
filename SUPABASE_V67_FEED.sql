-- Additive V67 migration. Run after existing ZION migrations. No account resets.
begin;
create table if not exists public.zion_feed_posts (
 id uuid primary key, owner_id uuid not null references public.profiles(id) on delete cascade,
 body text not null default '' check(length(body)<=3000), media_path text unique,
 media_kind text check(media_kind in ('image','video')), created_at timestamptz not null default now(),
 check((media_path is null)=(media_kind is null)),check(length(btrim(body))>0 or media_path is not null)
);
create index if not exists zion_feed_order on public.zion_feed_posts(created_at desc,id desc);
create table if not exists public.zion_feed_likes (
 post_id uuid references public.zion_feed_posts(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete cascade,primary key(post_id,user_id)
);
alter table public.zion_feed_posts enable row level security;
alter table public.zion_feed_likes enable row level security;
revoke all on public.zion_feed_posts,public.zion_feed_likes from anon,authenticated;
create or replace function public.zion_feed_active() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles where id=auth.uid() and not coalesce(is_banned,false));
$$;
create or replace function public.zion_feed_page(p_before timestamptz default null,p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.zion_feed_active() then raise exception 'Sign in with an active profile';end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc) from (
 select p.*,a.username,(select count(*) from public.zion_feed_likes l where l.post_id=p.id) as likes,
 exists(select 1 from public.zion_feed_likes l where l.post_id=p.id and l.user_id=auth.uid()) as liked,
 (p.owner_id=auth.uid() or exists(select 1 from public.profiles where id=auth.uid() and is_admin)) as can_delete
 from public.zion_feed_posts p join public.profiles a on a.id=p.owner_id
 where not coalesce(a.is_banned,false) and (p_before is null or (p.created_at,p.id)<(p_before,p_id))
 order by p.created_at desc,p.id desc limit 20) r),'[]'::jsonb);
end $$;
create or replace function public.zion_feed_publish(p_id uuid,p_body text,p_path text default null,p_kind text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();
begin
 if not public.zion_feed_active() then raise exception 'Sign in with an active profile';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,67));
 if exists(select 1 from public.zion_feed_posts where id=p_id and owner_id=uid) then return p_id;end if;
 if length(coalesce(p_body,''))>3000 or (length(btrim(coalesce(p_body,'')))=0 and p_path is null) then raise exception 'Write something or add media';end if;
 if exists(select 1 from public.zion_feed_posts where owner_id=uid and created_at>now()-interval '10 seconds') then raise exception 'Please wait 10 seconds before posting again';end if;
 if p_path is not null then
  if split_part(p_path,'/',1)<>uid::text or split_part(p_path,'/',2)<>p_id::text or p_kind not in ('image','video') or p_kind is null then raise exception 'Invalid media';end if;
  if not exists(select 1 from storage.objects where bucket_id='zion-feed' and name=p_path
   and ((p_kind='image' and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp') and (metadata->>'size')::bigint<=10485760)
    or (p_kind='video' and metadata->>'mimetype' in ('video/mp4','video/webm') and (metadata->>'size')::bigint<=52428800))) then raise exception 'Upload missing or unsupported';end if;
 end if;
 insert into public.zion_feed_posts(id,owner_id,body,media_path,media_kind) values(p_id,uid,btrim(coalesce(p_body,'')),p_path,p_kind);
 return p_id;
end $$;
create or replace function public.zion_feed_like(p_id uuid,p_liked boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.zion_feed_active() then raise exception 'Sign in with an active profile';end if;
 if not exists(select 1 from public.zion_feed_posts p join public.profiles a on a.id=p.owner_id where p.id=p_id and not coalesce(a.is_banned,false)) then raise exception 'Post unavailable';end if;
 if p_liked then insert into public.zion_feed_likes values(p_id,auth.uid()) on conflict do nothing;
 else delete from public.zion_feed_likes where post_id=p_id and user_id=auth.uid();end if;
 return jsonb_build_object('liked',p_liked,'likes',(select count(*) from public.zion_feed_likes where post_id=p_id));
end $$;
create or replace function public.zion_feed_delete(p_id uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare path text;
begin
 if not public.zion_feed_active() then raise exception 'Sign in with an active profile';end if;
 delete from public.zion_feed_posts where id=p_id and (owner_id=auth.uid() or exists(select 1 from public.profiles where id=auth.uid() and is_admin)) returning media_path into path;
 if not found then raise exception 'Post unavailable or permission denied';end if;
 return path;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('zion-feed','zion-feed',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists zion_feed_upload on storage.objects;
create policy zion_feed_upload on storage.objects for insert to authenticated with check(bucket_id='zion-feed' and public.zion_feed_active() and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists zion_feed_read on storage.objects;
create policy zion_feed_read on storage.objects for select to authenticated using(bucket_id='zion-feed' and public.zion_feed_active() and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.zion_feed_posts p join public.profiles a on a.id=p.owner_id where p.media_path=name and not coalesce(a.is_banned,false))));
-- Storage policy needs a narrow table read path; no direct mutation grants.
grant select on public.zion_feed_posts to authenticated;
drop policy if exists zion_feed_visible on public.zion_feed_posts;
create policy zion_feed_visible on public.zion_feed_posts for select to authenticated using(public.zion_feed_active() and exists(select 1 from public.profiles where id=owner_id and not coalesce(is_banned,false)));
drop policy if exists zion_feed_remove on storage.objects;
create policy zion_feed_remove on storage.objects for delete to authenticated using(bucket_id='zion-feed' and public.zion_feed_active() and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.profiles where id=auth.uid() and is_admin)));
revoke all on function public.zion_feed_active(),public.zion_feed_page(timestamptz,uuid),public.zion_feed_publish(uuid,text,text,text),public.zion_feed_like(uuid,boolean),public.zion_feed_delete(uuid) from public,anon;
grant execute on function public.zion_feed_active(),public.zion_feed_page(timestamptz,uuid),public.zion_feed_publish(uuid,text,text,text),public.zion_feed_like(uuid,boolean),public.zion_feed_delete(uuid) to authenticated;
commit;
