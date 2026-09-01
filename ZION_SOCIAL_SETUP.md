# ZION social features setup

## 1. Run the database update

Open Supabase **SQL Editor**, paste the complete `SUPABASE_FINAL_SQL.sql`, and run it once.

This creates profiles, friend requests, pinned friends, permanent friend messages, read receipts, ban fields, and the private `chat-media` Storage bucket.

## 2. Keep guest access enabled

In Supabase **Authentication → Sign In / Providers**, keep **Anonymous Sign-Ins** enabled.

Guest sessions remain in the current browser/app until its site/app data is cleared. A guest account cannot be recovered after that data is cleared.

## 3. Enable Google login

1. In Google Cloud Console, create an OAuth 2.0 Web Client.
2. Use this Supabase callback URL as an authorized redirect URI:
   `https://znkumqmbkwhrbekfyqvb.supabase.co/auth/v1/callback`
3. Copy the Google Client ID and Client Secret.
4. In Supabase **Authentication → Sign In / Providers → Google**, enable Google and paste the ID and secret.
5. In Supabase **Authentication → URL Configuration**, set the Site URL to:
   `https://zion-one-nu.vercel.app`
6. Add this redirect URL:
   `https://zion-one-nu.vercel.app/**`

If the browser shows `Unsupported provider: provider is not enabled`, Google
is still disabled in Supabase or its Client ID/Secret has not been saved.

Never put the Google Client Secret or Supabase service-role key in the app, GitHub, or Vercel public variables.

## 4. Media and moderation

- Photos and videos are private Storage objects and limited to 15 MB.
- Allowed media: JPEG, PNG, WebP, GIF, MP4, WebM, and QuickTime video.
- Gender is self-declared and is not presented as identity-verified.
- Admins can suspend a profile by setting `profiles.is_banned = true` and adding a `ban_reason` in Supabase Table Editor.
