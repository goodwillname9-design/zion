-- Run once after SUPABASE_FINAL_SQL.sql when upgrading to ZION V42.
alter table public.friend_messages add column if not exists view_once boolean not null default false;
alter table public.friend_messages add column if not exists viewed_at timestamptz;
alter table public.friend_messages drop constraint if exists friend_messages_media_type_check;
alter table public.friend_messages add constraint friend_messages_media_type_check
check(media_type is null or media_type in ('image','video','audio'));

create or replace function public.consume_view_once_message(p_message_id bigint)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  update public.friend_messages m set viewed_at=now()
  where m.id=p_message_id and m.view_once=true and m.viewed_at is null
    and m.sender_id<>auth.uid()
    and public.is_friendship_member(m.friendship_id,auth.uid());
  get diagnostics changed=row_count;
  return changed=1;
end;
$$;
revoke all on function public.consume_view_once_message(bigint) from public;
grant execute on function public.consume_view_once_message(bigint) to authenticated;
