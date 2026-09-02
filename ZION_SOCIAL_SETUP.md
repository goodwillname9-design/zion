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

The app cannot enable this provider by itself. The screenshot error
`Unsupported provider: provider is not enabled` is fixed only by completing
steps 1–6 above in this exact Supabase project.

## Email and password accounts

Keep Supabase Authentication > Providers > Email enabled. Users can create an
account with email/password, confirm their email when confirmation is enabled,
and then choose their unique ZION username on the profile screen.

If a guest is already signed in, open **Profile → Settings → Switch account ·
Email & password** to reveal the account login/create screen. **Logout** also
returns to that screen. The welcome hug animation opens automatically when the
home page first loads.

## Optional: delete every existing account and start fresh

`RESET_ALL_ZION_USERS.sql` is deliberately separate from the normal setup.
Open it, read the warning, change `confirm_complete_reset` from `false` to
`true`, and run it once in Supabase SQL Editor. This permanently deletes every
Google, email/password and guest account plus ZION profiles, chats, friends,
calls and uploaded media. Run `SUPABASE_FINAL_SQL.sql` first if the database
schema has not yet been installed.

## Browser audio-call limitation

ZION keeps the screen awake during an active call when the browser supports the
Wake Lock API and warns before closing the page. Mobile operating systems can
still suspend or end a PWA call after the browser/app is fully closed. Reliable
closed-app calling and manual earpiece/speaker routing require a native mobile
app; headphones otherwise follow the phone or computer's selected audio output.

## 4. Media and moderation

- Photos and videos are private Storage objects and limited to 15 MB.
- Allowed media: JPEG, PNG, WebP, GIF, MP4, WebM, and QuickTime video.
- Gender is self-declared and is not presented as identity-verified.
- Admins can suspend a profile by setting `profiles.is_banned = true` and adding a `ban_reason` in Supabase Table Editor.
