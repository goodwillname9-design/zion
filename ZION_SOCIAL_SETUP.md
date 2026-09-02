# ZION social features setup

## 1. Run the database update

Open Supabase **SQL Editor**, paste the complete `SUPABASE_FINAL_SQL.sql`, and run it once.

This creates profiles, friend requests, pinned friends, permanent friend messages, read receipts, ban fields, and the private `chat-media` Storage bucket.

## 2. Username and password accounts

ZION does not show Google, guest or email login. Keep Supabase
**Authentication → Sign In / Providers → Email** enabled, then turn
**Confirm email** off. ZION privately derives an internal, non-public auth
identifier from the username; users only enter their username and password.

Usernames support Malayalam, Arabic, Hindi and other Unicode languages. The
same username/password works on another device. The app remembers at most two
usernames per browser/device and never stores passwords. This device limit is
a convenience control: clearing browser storage or using another browser resets
the local list.

The login username is permanent for new accounts. Country can be changed once
from Profile Settings. Hold the profile button for about one second to open
**Add or switch account**. The welcome hug animation appears before login every
time the site/app is freshly opened.

## Optional: delete every existing account and start fresh

`RESET_ALL_ZION_USERS.sql` is deliberately separate from the normal setup.
Open it, read the warning, change `confirm_complete_reset` from `false` to
`true`, and run it once in Supabase SQL Editor. This permanently deletes every
all username/password and legacy accounts plus ZION profiles, chats, friends and
calls. Supabase blocks direct SQL deletion of Storage objects: delete the files
inside `chat-media` and `profile-avatars` from the Storage Dashboard, but keep
the buckets. Run `SUPABASE_FINAL_SQL.sql` first if the schema is not installed.

## Browser audio-call limitation

ZION keeps the screen awake during an active call when the browser supports the
Wake Lock API and warns before closing the page. Mobile operating systems can
still suspend or end a PWA call after the browser/app is fully closed. Reliable
closed-app calling and manual earpiece/speaker routing require a native mobile
app; headphones otherwise follow the phone or computer's selected audio output.

## Secure group meetings and screen sharing

The **Friends → Meetings** section opens ZION Business Meetings. Signed-in
users can create or join a private room using a Meeting ID and separate
passcode. The passcode is not included in the invite link. Access is issued as
a short-lived server-generated LiveKit token.

Add these server-side Vercel environment variables and redeploy:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Never use a `NEXT_PUBLIC_` prefix for the API key or secret. LiveKit provides
group camera/audio, participant layouts, microphone/camera controls and screen
sharing. Screen sharing availability depends on browser and operating-system
support; mobile Safari has additional platform restrictions.

## 4. Media and moderation

- Photos and videos are private Storage objects and limited to 15 MB.
- Allowed media: JPEG, PNG, WebP, GIF, MP4, WebM, and QuickTime video.
- Gender is self-declared and is not presented as identity-verified.
- Admins can suspend a profile by setting `profiles.is_banned = true` and adding a `ban_reason` in Supabase Table Editor.
