# ZION V77 — Social interface and peaceful Kerala guide

Base: complete V76 project. Existing media authentication, view-once endpoint, Supabase account structure, LiveKit configuration and CEO access retained.

## Deploy
1. Extract this complete ZIP into your existing ZION project folder.
2. In Supabase SQL Editor run `SUPABASE_V77_SOCIAL.sql` once, AFTER the existing V73 migration. Do not rerun all historical migrations. This blocks weapon buying, firing, reloading and combat rounds on the server and expires current rounds. Account data and balances remain intact.
3. Keep existing Vercel environment values, including the working server media key.
4. In VS Code terminal:
```sh
npm ci
npm run build
git add .
git commit -m "ZION V77 social interface and peaceful Kerala world"
git push
```
5. Wait for the production deployment to be Ready, then reopen ZION.

## Changes
- Compact dark friend list and mobile bottom tabs: Updates (existing feed), Chats, Reels, Games, Settings. Find Friends lives in the search bar. Meetings, notifications, communities and CEO admin remain accessible.
- Link sharing: paste HTTP(S) or www links in messages; safe clickable links appear after decryption. No external link preview service receives private chat content.
- Chat scroll follows the bottom only while already near the bottom. Media updates no longer animate the whole history. Existing encryption/upload pipeline preserved.
- Fullscreen call layout shows the other person's actual ZION username and avatar/photo. Existing mute, sound, video camera and hang-up controls retained. Back to chat minimizes without remounting the media elements. Browser sound toggle is not a guaranteed hardware earphone/speaker selector.
- Game combat controls, gun display and hostile NPC damage disabled. Server migration enforces the same policy.
- Coastal sea, beach strip and palms added outside the existing collision layout.
- Kerala guide includes 14 districts and example destinations, an approximate district-centre diagram, and optional real OpenStreetMap embeds. This is a guide, NOT 14 playable districts or an exact reconstruction of Kerala. Existing playable map is still a stylised village; detailed houses and landmarks remain future work.
- Public title/description and About content updated. Google indexing/ranking is not guaranteed. In Search Console submit `https://zion-one-nu.vercel.app/sitemap.xml` and inspect `/about`; request indexing after deploying if needed.

## Validation and limits
Production build, existing V76 view-once and V69 upload regressions; local PGlite checks for weapon/round rejection and peaceful player sync. These do not constitute physical iPhone/Android, real two-account call, or multiplayer load testing. Existing room limit remains 20; no unlimited-player or zero-lag guarantee.

## Sources
https://www.keralatourism.org/destination/
https://www.openstreetmap.org/copyright
https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
