-- V63: additive, private 4-player city exploration rooms.
-- Run AFTER your existing ZION schema/security migrations. No existing tables/policies are changed.
begin;
create table if not exists public.zion_city_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  code text not null unique default substr(replace(gen_random_uuid()::text,'-',''),1,16),
  expires_at timestamptz not null default now()+interval '2 hours'
);
create table if not exists public.zion_city_players (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  room_id uuid not null references public.zion_city_rooms(id) on delete cascade,
  x double precision not null default 3,
  z double precision not null default 3,
  yaw double precision not null default 0,
  vehicle text not null default '',
  seen_at timestamptz not null default now()
);
create index if not exists zion_city_players_room on public.zion_city_players(room_id);
alter table public.zion_city_rooms enable row level security;
alter table public.zion_city_players enable row level security;
revoke all on public.zion_city_rooms, public.zion_city_players from anon, authenticated;
-- Only these scoped functions access the new tables. No client-supplied identity is accepted.
create or replace function public.zion_city_join(p_code text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid:=auth.uid(); r public.zion_city_rooms; n integer;
begin
  if uid is null or not exists(select 1 from public.profiles where id=uid and not is_banned) then raise exception 'Sign in with an active ZION profile first'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,63));
  if p_code is null or btrim(p_code)='' then
    select * into r from public.zion_city_rooms where host_id=uid and expires_at>now() order by expires_at desc limit 1 for update;
    if not found then
      delete from public.zion_city_rooms where host_id=uid and expires_at<=now();
      insert into public.zion_city_rooms(host_id) values(uid) returning * into r;
    end if;
  else
    if p_code !~ '^[a-fA-F0-9]{16}$' then raise exception 'Invalid room code'; end if;
    select * into r from public.zion_city_rooms where code=lower(p_code) and expires_at>now() for update;
    if not found then raise exception 'Room not found or expired'; end if;
    if r.host_id<>uid and not exists(select 1 from public.friendships where status='accepted' and ((requester_id=uid and addressee_id=r.host_id) or (addressee_id=uid and requester_id=r.host_id))) then raise exception 'Only accepted friends of the host can join'; end if;
    if exists(select 1 from public.profiles where id=r.host_id and is_banned) then raise exception 'Room unavailable'; end if;
  end if;
  delete from public.zion_city_players where room_id=r.id and seen_at<now()-interval '30 seconds';
  select count(*) into n from public.zion_city_players where room_id=r.id and user_id<>uid;
  if n>=4 then raise exception 'Room is full (4 players)'; end if;
  insert into public.zion_city_players(user_id,room_id) values(uid,r.id)
    on conflict(user_id) do update set room_id=excluded.room_id,seen_at=now();
  return jsonb_build_object('id',r.id,'code',r.code,'user_id',uid);
end $$;
create or replace function public.zion_city_sync(p_room uuid,p_x double precision,p_z double precision,p_yaw double precision,p_vehicle text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid:=auth.uid(); r public.zion_city_rooms;
begin
  if uid is null or not exists(select 1 from public.profiles where id=uid and not is_banned) then raise exception 'Session unavailable'; end if;
  if not (p_x between -120 and 120 and p_z between -121 and 121 and p_yaw between -100 and 100) or p_x is null or p_z is null or p_yaw is null or p_vehicle is null or p_vehicle not in ('','Sedan','Motorcycle') then raise exception 'Invalid player state'; end if;
  select * into r from public.zion_city_rooms where id=p_room and expires_at>now();
  if not found then raise exception 'Room expired'; end if;
  if exists(select 1 from public.profiles where id=r.host_id and is_banned) then raise exception 'Room unavailable'; end if;
  if r.host_id<>uid and not exists(select 1 from public.friendships where status='accepted' and ((requester_id=uid and addressee_id=r.host_id) or (addressee_id=uid and requester_id=r.host_id))) then raise exception 'Friend access removed'; end if;
  if not exists(select 1 from public.zion_city_players where user_id=uid and room_id=p_room) then raise exception 'Join the room first'; end if;
  update public.zion_city_players set x=p_x,z=p_z,yaw=p_yaw,vehicle=p_vehicle,seen_at=now()
    where user_id=uid and room_id=p_room and seen_at<now()-interval '150 milliseconds';
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'username',a.username,'x',p.x,'z',p.z,'yaw',p.yaw,'vehicle',p.vehicle))
    from public.zion_city_players p join public.profiles a on a.id=p.user_id
    where p.room_id=p_room and p.seen_at>now()-interval '30 seconds' and not a.is_banned),'[]'::jsonb);
end $$;
create or replace function public.zion_city_leave(p_room uuid)
returns void language sql security definer set search_path=public,pg_temp as $$
  delete from public.zion_city_players where user_id=auth.uid() and room_id=p_room;
$$;
revoke all on function public.zion_city_join(text),public.zion_city_sync(uuid,double precision,double precision,double precision,text),public.zion_city_leave(uuid) from public,anon;
grant execute on function public.zion_city_join(text),public.zion_city_sync(uuid,double precision,double precision,double precision,text),public.zion_city_leave(uuid) to authenticated;
commit;
