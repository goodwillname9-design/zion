begin;
alter table public.zion_job_profiles add column if not exists owns_gun boolean not null default false;
alter table public.zion_job_profiles add column if not exists fines integer not null default 0;
alter table public.zion_job_profiles add column if not exists last_fine timestamptz;
alter table public.zion_job_profiles add column if not exists jailed_until timestamptz;
create or replace function public.zion_life(p_room uuid,p_action text default 'status',p_target uuid default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();j public.zion_job_profiles;pos public.zion_city_players;t public.zion_city_players;
begin
 perform 1 from public.zion_city_rooms where id=p_room for update;
 if not public.zion_game_call_access(p_room) then raise exception 'Active world access required';end if;
 insert into public.zion_job_profiles(user_id) values(uid) on conflict do nothing;
 select * into j from public.zion_job_profiles where user_id=uid for update;
 select * into pos from public.zion_city_players where user_id=uid and room_id=p_room;
 if j.jailed_until>now() and p_action<>'status' then raise exception 'Wait for your sentence to end';end if;
 if p_action='buy' then
 if sqrt(power(pos.x-42,2)+power(pos.z-7,2))>9 then raise exception 'Visit gun shop S (42,7)';end if;
 if j.owns_gun then raise exception 'Already owned';end if;
 if j.cash<300 then raise exception 'Earn $300 career money first';end if;
 update public.zion_job_profiles set cash=cash-300,owns_gun=true where user_id=uid;
 elsif p_action='pay' then
 if sqrt(power(pos.x-7,2)+power(pos.z-42,2))>9 then raise exception 'Visit the station at (7,42)';end if;
 if j.cash<j.fines then raise exception 'Not enough savings to pay fines';end if;
 update public.zion_job_profiles set cash=cash-fines,fines=0 where user_id=uid;
 elsif p_action='arrest' then
 if j.role<>'Police' or p_target is null or p_target=uid then raise exception 'Police only; choose another player';end if;
 select * into t from public.zion_city_players where room_id=p_room and user_id=p_target and seen_at>now()-interval '15 seconds';
 if not found or sqrt(power(pos.x-t.x,2)+power(pos.z-t.z,2))>5 then raise exception 'Target must be within 5 metres';end if;
 update public.zion_job_profiles set jailed_until=now()+interval '30 seconds',fines=0,started_at=null where user_id=p_target and fines>=150 and (jailed_until is null or jailed_until<=now());
 if not found then raise exception 'Arrest requires at least $150 unpaid fines';end if;
 update public.zion_city_players set x=7,z=46,vehicle='' where user_id=p_target;
 elsif p_action='heal' then
 if sqrt(power(pos.x-7,2)+power(pos.z-42,2))>9 then raise exception 'Visit the station first-aid desk';end if;
 if j.cash<25 then raise exception 'First aid costs $25';end if;
 update public.zion_forest_fighters set hp=100,respawn_at=null where user_id=uid and room_id=p_room and hp<100;
 if found then update public.zion_job_profiles set cash=cash-25 where user_id=uid;end if;
 elsif p_action<>'status' then raise exception 'Unknown action';end if;
 select * into j from public.zion_job_profiles where user_id=uid;
 return jsonb_build_object('cash',j.cash,'fines',j.fines,'owns_gun',j.owns_gun,'jailed_until',j.jailed_until,'nearby',coalesce((select jsonb_agg(jsonb_build_object('id',nearby.user_id,'username',a.username)) from public.zion_city_players nearby join public.profiles a on a.id=nearby.user_id where nearby.room_id=p_room and nearby.user_id<>uid and nearby.seen_at>now()-interval '15 seconds' and sqrt(power(nearby.x-pos.x,2)+power(nearby.z-pos.z,2))<=5),'[]'::jsonb));
end $$;
revoke all on function public.zion_life(uuid,text,uuid) from public,anon;
grant execute on function public.zion_life(uuid,text,uuid) to authenticated;
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
 insert into public.zion_job_profiles(user_id) values(uid) on conflict do nothing;
 if exists(select 1 from public.zion_job_profiles where user_id=uid and jailed_until>now()) then p_x:=7;p_z:=46;p_vehicle:='';p_action:='sync';update public.zion_city_players set x=7,z=46,vehicle='' where user_id=uid;old.x:=7;old.z:=46;end if;
 if p_action='fire' and not exists(select 1 from public.zion_job_profiles where user_id=uid and owns_gun) then raise exception 'Buy a gun at S with career savings first';end if;
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
  if p_vehicle<>'' and extract(epoch from now()-old.seen_at)>0.1 and sqrt(power(p_x-old.x,2)+power(p_z-old.z,2))/extract(epoch from now()-old.seen_at)*3.6 > (case when abs(p_x-7)<15 and p_z between -45 and -15 then 20 else 60 end) then
 update public.zion_job_profiles set fines=fines+50,last_fine=now() where user_id=uid and (last_fine is null or last_fine<now()-interval '20 seconds');
 if found then result:='Speeding: $50 fine. School limit 20 km/h; other roads 60 km/h';end if;end if;
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
 return jsonb_build_object('message',result,'round',jsonb_build_object('number',q.round_no,'ends_at',q.ends_at,'active',coalesce(active,false),'host',r.host_id=uid),'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'username',a.username,'jailed_until',(select jailed_until from public.zion_job_profiles where user_id=p.user_id),'owns_gun',coalesce((select owns_gun from public.zion_job_profiles where user_id=p.user_id),false),'role',coalesce((select role from public.zion_job_profiles where user_id=p.user_id),'Explorer'),'x',p.x,'z',p.z,'yaw',p.yaw,'vehicle',p.vehicle,'hp',c.hp,'ammo',c.ammo,'kills',c.kills,'respawn_at',c.respawn_at)) from public.zion_city_players p join public.profiles a on a.id=p.user_id join public.zion_forest_fighters c on c.room_id=p.room_id and c.user_id=p.user_id where p.room_id=p_room and p.seen_at>now()-interval '15 seconds' and not coalesce(a.is_banned,false)),'[]'::jsonb));
end $$;
insert into public.zion_forest_cover(id,x,z,w,d) values(300,16,42,3,2.5),(301,16,-30,3,2.5),(302,49,7,3,2.5) on conflict(id) do update set x=excluded.x,z=excluded.z,w=excluded.w,d=excluded.d;
commit;
