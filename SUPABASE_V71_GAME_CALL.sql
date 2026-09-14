begin;
create or replace function public.zion_game_call_access(p_room uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
select exists(select 1 from public.zion_city_rooms r join public.zion_city_players p on p.room_id=r.id join public.profiles u on u.id=p.user_id join public.profiles h on h.id=r.host_id where r.id=p_room and p.user_id=auth.uid() and r.expires_at>now() and p.seen_at>now()-interval '30 seconds' and not coalesce(u.is_banned,false) and not coalesce(h.is_banned,false) and (r.host_id=auth.uid() or exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=auth.uid() and f.addressee_id=r.host_id) or (f.addressee_id=auth.uid() and f.requester_id=r.host_id)))))
$$;
revoke all on function public.zion_game_call_access(uuid) from public,anon;
grant execute on function public.zion_game_call_access(uuid) to authenticated;
commit;
