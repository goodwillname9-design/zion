-- ZION COMPLETE ACCOUNT RESET
-- WARNING: This permanently deletes every ZION account, profile, friendship,
-- stranger/friend message, call record and uploaded chat/profile media file.
-- Run this only in the correct Supabase project's SQL Editor.

do $$
declare
  confirm_complete_reset boolean := false; -- Change ONLY this value to true.
  table_name text;
begin
  if not confirm_complete_reset then
    raise exception 'RESET CANCELLED. Change confirm_complete_reset to true only when you really want to delete every ZION account.';
  end if;

  -- Storage metadata is removed first. Supabase will then remove the objects.
  delete from storage.objects
  where bucket_id in ('chat-media', 'profile-avatars');

  -- TRUNCATE every ZION table that exists. CASCADE safely resolves foreign keys.
  foreach table_name in array array[
    'friend_calls', 'friend_messages', 'friend_pins', 'friendships',
    'conversation_answers', 'messages', 'match_queue', 'conversations',
    'user_blocks', 'profiles'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('truncate table public.%I cascade', table_name);
    end if;
  end loop;

  -- This also removes Google, email/password and anonymous/guest auth users.
  delete from auth.users;

  raise notice 'ZION reset complete. Every user must create a new account/profile.';
end
$$;

