# ZION V68 setup

Use this complete project in place of your previous source. Existing LiveKit credentials, Supabase configuration and CEO identity are retained. No live deployment or database changes have been performed for you.

## Database and environment

In the same Supabase project, retain all existing migrations. If not previously applied, apply SUPABASE_V63_CITY.sql and SUPABASE_V67_FEED.sql first. Then run these files in order in SQL Editor:

1. SUPABASE_V68_COMBAT.sql
2. SUPABASE_V68_FEED.sql
3. SUPABASE_V68_PRIVACY.sql

Do not rerun V63 after V68: it restores an old movement RPC permission revoked by V68. Deploy this client and these migrations together.

Add SUPABASE_SERVICE_ROLE_KEY in Vercel project environment variables for the deployment environment, using the service_role key from the same Supabase project. Keep it server-only, never NEXT_PUBLIC_, never in Git or chat. Retain existing Supabase and LiveKit variables. Redeploy after changing variables. Meeting failures caused by mismatched LiveKit credentials still require matching URL, key and secret from one LiveKit project.

## Current changes

- Forest/off-road arena with friend rooms, player names, server-managed health, ammunition, hit checks, cover checks, kills, reload and five-second respawn. Host starts a three-minute round with at least two connected players; rooms support up to four. Mobile joystick and drag aiming included.
- Social feed for authenticated users with photo/video posting, comments and reports; administrator report review.
- View-once photos and videos, up to roughly 4 MiB including encryption overhead. Server claims access atomically before delivery, denies direct storage reads, and attempts object removal. Opening consumes the item even if delivery subsequently fails. Storage deletion failure can leave an inaccessible stored object; this is not a guarantee of physical erasure or screenshot prevention.
- CEO-only browser/session activity list with last-seen time. Browser-reported device information is not verified hardware identity or proof of a currently authenticated session.
- Upload retry/cancel transport fix; prior light-cord theme switch and existing ZION features retained.

## Limits

Whole-chat after-view deletion settings are NOT included. A website cannot guarantee screenshot or screen-recording blocking, black screenshots, or reliable capture notifications. Forest graphics and multiplayer are a prototype, not photorealistic PUBG or a production anti-cheat system; zero lag is not guaranteed. No physical iPhone/Android or live multi-user Supabase test has been completed. Local SQL fixture checks and production compilation do not replace deployment testing.

## VS Code terminal

```sh
npm ci
npm run build
git add app lib public/sw.js .env.example SUPABASE_V68_COMBAT.sql SUPABASE_V68_FEED.sql SUPABASE_V68_PRIVACY.sql V68_SETUP.md
git commit -m "ZION V68: forest arena, social feed and view-once updates"
git push
```

After deployment test with two accounts: invite/accept and round start; movement, cover, hits and respawn; normal and once-only media; cancelled uploads; feed reports; non-CEO denial of device records. Keep database and storage backups before applying migrations.
