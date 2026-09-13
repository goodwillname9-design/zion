begin;
alter table public.zion_city_rooms add column if not exists is_public boolean not null default false;
create table if not exists public.zion_job_profiles(user_id uuid primary key references public.profiles(id) on delete cascade,role text not null default 'Explorer',cash integer not null default 0,xp integer not null default 0,started_at timestamptz,origin_x double precision,origin_z double precision);
alter table public.zion_job_profiles enable row level security;
revoke all on public.zion_job_profiles from anon,authenticated;
create or replace function public.zion_job(p_room uuid,p_role text default null,p_action text default 'status') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.zion_job_profiles;pos public.zion_city_players;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and not coalesce(is_banned,false)) then raise exception 'Active login required';end if;
 select * into pos from public.zion_city_players where user_id=auth.uid() and room_id=p_room and seen_at>now()-interval '30 seconds';
 if not found or not exists(select 1 from public.zion_city_rooms where id=p_room and expires_at>now()) then raise exception 'Join a world first';end if;
 if not public.zion_game_call_access(p_room) then raise exception 'World access removed';end if;
 insert into public.zion_job_profiles(user_id) values(auth.uid()) on conflict do nothing;
 select * into j from public.zion_job_profiles where user_id=auth.uid() for update;
 if p_action='choose' then
 if not (p_role=any(ARRAY['Police','Soldier','Navy','Air force','Security guard','Bodyguard','Prison warden','Firefighter','Lifeguard','Ambulance driver','Paramedic','Doctor','Nurse','Pharmacist','Lab technician','Physiotherapist','Teacher','Professor','Trainer','Librarian','Engineer','Architect','Mason','Carpenter','Electrician','Plumber','Painter','Taxi driver','Truck driver','Pilot','Ship captain','Train driver','Conductor','Delivery worker','Mechanic','Welder','AC technician','Mobile technician','Software developer','Graphic designer','Video editor','Animator','Game developer','Chef','Baker','Waiter','Hotel manager','Receptionist','Farmer','Fisher','Gardener','Animal keeper','Forest guard','Miner','Shopkeeper','Salesperson','Cashier','Accountant','Bank employee','Office assistant','Lawyer','Judge','Government officer','Postal worker','Actor','Singer','Dancer','Photographer','Journalist','Director','Cleaner','Domestic worker','Barber','Beautician','Tailor','Athlete','Coach','Referee','Fitness trainer','Scientist','Researcher','Astronaut'])) then raise exception 'Unknown job';end if;
 update public.zion_job_profiles set role=p_role,started_at=null where user_id=auth.uid() returning * into j;
 elsif p_action='start' then
 if j.role='Explorer' then raise exception 'Choose a job';end if;
 if j.started_at is null then update public.zion_job_profiles set started_at=now(),origin_x=pos.x,origin_z=pos.z where user_id=auth.uid() returning * into j;end if;
 elsif p_action='complete' then
 if j.started_at is null or j.started_at>now()-interval '30 seconds' then raise exception 'Work for at least 30 seconds first';end if;
 if sqrt(power(pos.x-j.origin_x,2)+power(pos.z-j.origin_z,2))<20 then raise exception 'Travel at least 20 metres from your starting point';end if;
 update public.zion_job_profiles set cash=cash+100,xp=xp+25,started_at=null where user_id=auth.uid() returning * into j;
 elsif p_action<>'status' then raise exception 'Unknown action';end if;
 return jsonb_build_object('role',j.role,'cash',j.cash,'xp',j.xp,'level',1+j.xp/250,'started_at',j.started_at);
end $$;
revoke all on function public.zion_job(uuid,text,text) from public,anon;
grant execute on function public.zion_job(uuid,text,text) to authenticated;
create or replace function public.zion_city_join(p_code text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid:=auth.uid(); r public.zion_city_rooms; n integer;
begin
  if uid is null or not exists(select 1 from public.profiles where id=uid and not is_banned) then raise exception 'Sign in with an active ZION profile first'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,63));
  if p_code='public' then
    perform pg_advisory_xact_lock(72001);
    delete from public.zion_city_players where seen_at<now()-interval '30 seconds';
    select * into r from public.zion_city_rooms w where w.is_public and w.expires_at>now() and not exists(select 1 from public.profiles where id=w.host_id and is_banned) and (select count(*) from public.zion_city_players where room_id=w.id and user_id<>uid)<20 order by w.expires_at desc limit 1 for update;
    if not found then insert into public.zion_city_rooms(host_id,is_public) values(uid,true) returning * into r;end if;
  elsif p_code is null or btrim(p_code)='' then
    select * into r from public.zion_city_rooms where host_id=uid and not is_public and expires_at>now() order by expires_at desc limit 1 for update;
    if not found then
      delete from public.zion_city_rooms where host_id=uid and expires_at<=now();
      insert into public.zion_city_rooms(host_id) values(uid) returning * into r;
    end if;
  else
    if p_code !~ '^[a-fA-F0-9]{16}$' then raise exception 'Invalid room code'; end if;
    select * into r from public.zion_city_rooms where code=lower(p_code) and expires_at>now() for update;
    if not found then raise exception 'Room not found or expired'; end if;
    if not r.is_public and r.host_id<>uid and not exists(select 1 from public.friendships where status='accepted' and ((requester_id=uid and addressee_id=r.host_id) or (addressee_id=uid and requester_id=r.host_id))) then raise exception 'Only accepted friends of the host can join'; end if;
    if exists(select 1 from public.profiles where id=r.host_id and is_banned) then raise exception 'Room unavailable'; end if;
  end if;
  delete from public.zion_city_players where room_id=r.id and seen_at<now()-interval '30 seconds';
  select count(*) into n from public.zion_city_players where room_id=r.id and user_id<>uid;
  if n>=20 then raise exception 'Room is full (20 players)'; end if;
  insert into public.zion_city_players(user_id,room_id) values(uid,r.id)
    on conflict(user_id) do update set room_id=excluded.room_id,seen_at=now();
  return jsonb_build_object('id',r.id,'code',r.code,'user_id',uid);
end $$;
create or replace function public.zion_forest_command(p_room uuid,p_action text,p_x double precision,p_z double precision,p_yaw double precision,p_vehicle text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();r public.zion_city_rooms;q public.zion_forest_rounds;f public.zion_forest_fighters;
 old public.zion_city_players;target uuid;elapsed double precision;result text:='';active boolean; hit_x double precision;hit_z double precision;
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and not coalesce(is_banned,false)) then raise exception 'Active login required';end if;
 select * into r from public.zion_city_rooms where id=p_room and expires_at>now() for update;
 if not found then raise exception 'Room expired';end if;
 if exists(select 1 from public.profiles where id=r.host_id and is_banned) then raise exception 'Room unavailable';end if;
 if not r.is_public and uid<>r.host_id and not exists(select 1 from public.friendships where status='accepted' and ((requester_id=uid and addressee_id=r.host_id)or(addressee_id=uid and requester_id=r.host_id))) then raise exception 'Friend access removed';end if;
 select * into old from public.zion_city_players where room_id=p_room and user_id=uid;
 if not found then raise exception 'Join this room first';end if;
 if p_action not in ('sync','fire','reload','start') or p_action is null then raise exception 'Unknown action';end if;
 if p_x is null or p_z is null or p_yaw is null or not(p_x between -119 and 119 and p_z between -120 and 120 and p_yaw between -3.142 and 3.142) or p_vehicle is null or p_vehicle not in ('','Sedan','Motorcycle') then raise exception 'Invalid position';end if;
 insert into public.zion_forest_rounds(room_id) values(p_room) on conflict do nothing;
 insert into public.zion_forest_fighters(room_id,user_id) values(p_room,uid) on conflict do nothing;
 select * into q from public.zion_forest_rounds where room_id=p_room;
 if p_action='start' and r.is_public then raise exception 'Public worlds are peaceful job worlds';end if;
 if p_action='start' then
  if uid<>r.host_id then raise exception 'Only the host can start';end if;
  if q.ends_at>now() then raise exception 'Round already running';end if;
  if (select count(*) from public.zion_city_players where room_id=p_room and seen_at>now()-interval '15 seconds')<2 then raise exception 'Two connected players required';end if;
  update public.zion_forest_rounds set ends_at=now()+interval '3 minutes',round_no=round_no+1 where room_id=p_room returning * into q;
  insert into public.zion_forest_fighters(room_id,user_id) select p_room,user_id from public.zion_city_players where room_id=p_room on conflict do nothing;
  update public.zion_forest_fighters set hp=100,ammo=12,kills=0,reload_at=null,respawn_at=null,last_shot='-infinity' where room_id=p_room;
  result:='Round started';
 end if;
 update public.zion_forest_fighters set hp=100,ammo=12,respawn_at=null where room_id=p_room and respawn_at<=now();
 update public.zion_forest_fighters set ammo=12,reload_at=null where room_id=p_room and reload_at<=now();
 select * into f from public.zion_forest_fighters where room_id=p_room and user_id=uid;
 elapsed:=least(1,greatest(0,extract(epoch from now()-old.seen_at)));
 if f.hp>0 and sqrt(power(p_x-old.x,2)+power(p_z-old.z,2))<=30*elapsed+0.75 and not public.zion_forest_blocked(old.x,old.z,p_x,p_z,case when p_vehicle='' then 0.5 else 1.6 end) then
  update public.zion_city_players set x=p_x,z=p_z,yaw=p_yaw,vehicle=p_vehicle,seen_at=now() where room_id=p_room and user_id=uid;
 else update public.zion_city_players set seen_at=now() where room_id=p_room and user_id=uid; p_x:=old.x;p_z:=old.z;p_yaw:=old.yaw;end if;
 active:=q.ends_at>now();
 if p_action in ('fire','reload') and (not coalesce(active,false) or f.hp<=0) then result:='Wait for an active round and respawn';
 elsif p_action='reload' and f.reload_at is null and f.ammo<12 then
  update public.zion_forest_fighters set reload_at=now()+interval '1.2 seconds' where room_id=p_room and user_id=uid;result:='Reloading';
 elsif p_action='fire' and f.reload_at is null and f.ammo>0 and f.last_shot<now()-interval '300 milliseconds' and p_vehicle='' then
  update public.zion_forest_fighters set ammo=ammo-1,last_shot=now() where room_id=p_room and user_id=uid;
  -- Server chooses the nearest target along the player's facing direction.
  select p.user_id,p.x,p.z into target,hit_x,hit_z from public.zion_city_players p join public.zion_forest_fighters c on c.room_id=p.room_id and c.user_id=p.user_id join public.profiles a on a.id=p.user_id
  where p.room_id=p_room and p.user_id<>uid and c.hp>0 and not coalesce(a.is_banned,false) and p.seen_at>now()-interval '5 seconds'
   and (p.x-p_x)*sin(p_yaw)+(p.z-p_z)*cos(p_yaw) between 0.5 and 45
   and abs((p.x-p_x)*cos(p_yaw)-(p.z-p_z)*sin(p_yaw))<0.65
  order by power(p.x-p_x,2)+power(p.z-p_z,2) limit 1;
  if target is not null and not public.zion_forest_blocked(p_x,p_z,hit_x,hit_z,0) then
   update public.zion_forest_fighters set hp=greatest(0,hp-25),respawn_at=case when hp<=25 then now()+interval '5 seconds' else null end where room_id=p_room and user_id=target;
   if exists(select 1 from public.zion_forest_fighters where room_id=p_room and user_id=target and hp=0) then update public.zion_forest_fighters set kills=kills+1 where room_id=p_room and user_id=uid;result:='Elimination';else result:='Hit';end if;
  else result:='Miss';end if;
 end if;
 return jsonb_build_object('message',result,'round',jsonb_build_object('number',q.round_no,'ends_at',q.ends_at,'active',coalesce(active,false),'host',r.host_id=uid),'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'username',a.username,'role',coalesce((select role from public.zion_job_profiles where user_id=p.user_id),'Explorer'),'x',p.x,'z',p.z,'yaw',p.yaw,'vehicle',p.vehicle,'hp',c.hp,'ammo',c.ammo,'kills',c.kills,'respawn_at',c.respawn_at)) from public.zion_city_players p join public.profiles a on a.id=p.user_id join public.zion_forest_fighters c on c.room_id=p.room_id and c.user_id=p.user_id where p.room_id=p_room and p.seen_at>now()-interval '15 seconds' and not coalesce(a.is_banned,false)),'[]'::jsonb));
end $$;
create table if not exists public.zion_world_chat(id bigint generated always as identity primary key,room_id uuid references public.zion_city_rooms(id) on delete cascade,user_id uuid references public.profiles(id) on delete cascade,body text not null check(length(body) between 1 and 500),created_at timestamptz not null default now());
create index if not exists zion_world_chat_room on public.zion_world_chat(room_id,id desc);
alter table public.zion_world_chat enable row level security;
revoke all on public.zion_world_chat from anon,authenticated;
create or replace function public.zion_world_chat(p_room uuid,p_body text default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.zion_city_players p join public.profiles a on a.id=p.user_id join public.zion_city_rooms r on r.id=p.room_id where p.user_id=auth.uid() and p.room_id=p_room and p.seen_at>now()-interval '30 seconds' and not coalesce(a.is_banned,false) and r.expires_at>now()) then raise exception 'Active world membership required';end if;
 if not public.zion_game_call_access(p_room) then raise exception 'World access removed';end if;
 if p_body is not null then
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,72));
 if length(btrim(p_body)) not between 1 and 500 then raise exception 'Use 1–500 characters';end if;
 if exists(select 1 from public.zion_world_chat where user_id=auth.uid() and created_at>now()-interval '2 seconds') then raise exception 'Wait before sending again';end if;
 insert into public.zion_world_chat(room_id,user_id,body) values(p_room,auth.uid(),btrim(p_body));end if;
 return coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from (select c.id,a.username,c.body from public.zion_world_chat c join public.profiles a on a.id=c.user_id where c.room_id=p_room and not coalesce(a.is_banned,false) order by c.id desc limit 30)m),'[]'::jsonb);
end $$;
revoke all on function public.zion_world_chat(uuid,text) from public,anon;
grant execute on function public.zion_world_chat(uuid,text) to authenticated;

create or replace function public.zion_game_call_access(p_room uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
select exists(select 1 from public.zion_city_rooms r join public.zion_city_players p on p.room_id=r.id join public.profiles u on u.id=p.user_id join public.profiles h on h.id=r.host_id where r.id=p_room and p.user_id=auth.uid() and r.expires_at>now() and p.seen_at>now()-interval '30 seconds' and not coalesce(u.is_banned,false) and not coalesce(h.is_banned,false) and (r.is_public or r.host_id=auth.uid() or exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=auth.uid() and f.addressee_id=r.host_id) or (f.addressee_id=auth.uid() and f.requester_id=r.host_id)))))
$$;
revoke all on function public.zion_game_call_access(uuid) from public,anon;
grant execute on function public.zion_game_call_access(uuid) to authenticated;

commit;
