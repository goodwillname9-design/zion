-- Additive V64 migration. Run in the existing ZION SQL Editor.
begin;
create or replace function public.zion_game_player_set(players uuid[])
returns uuid[] language sql immutable strict set search_path='' as $$
select array_agg(distinct p order by p) from unnest(players) p;
$$;
lock table public.friend_games in share row exclusive mode;
-- Keep the most accepted copy, then newest. Do not delete records or touch active games.
with ranked as (
 select id,row_number() over(partition by inviter_id,game_type,public.zion_game_player_set(participant_ids)
 order by cardinality(accepted_ids) desc,created_at desc,id desc) n
 from public.friend_games where status='pending'
)
update public.friend_games g set status='declined' from ranked r where g.id=r.id and r.n>1;
create unique index if not exists zion_one_pending_game_invite
on public.friend_games(inviter_id,game_type,public.zion_game_player_set(participant_ids)) where status='pending';
commit;
