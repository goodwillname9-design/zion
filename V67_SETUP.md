# ZION V67 — forest prototype, public feed, pull-cord theme

## Install

Copy this complete ZIP's extracted contents over your existing ZION Git checkout. Preserve `.env.local` and `.git`.

1. Supabase dashboard → SQL Editor → New query: paste and run **SUPABASE_V67_FEED.sql** once. This adds the public feed tables, RPCs and private media bucket. It does not reset users or change existing CEO flags. Without this migration the feed cannot load or publish.
2. VS Code terminal in your ZION folder:

```bash
npm ci
npm run build
git add app/social-shell.tsx app/experience.tsx app/layout.tsx app/light-cord.tsx app/light-cord.module.css app/public-feed.tsx app/public-feed.module.css app/city app/friend-games.tsx public/sw.js SUPABASE_V67_FEED.sql V67_SETUP.md tests/v67-model.mjs
git commit -m "ZION V67: forest prototype, public feed and pull-cord lights"
git push
```

3. Wait for Vercel deployment Ready. No new environment keys are required. Refresh/reopen the installed PWA.

## Public feed

Use the new Public feed button beside the existing navigation. Text up to 3,000 characters, one photo (10 MB) or video (50 MB) per post, preview, upload progress/retry, likes, native share (or copy text/site link), own-post deletion and refresh/load-more. JPG/PNG/WebP and MP4/WebM. Share opens the site, not a permanent single-post page.

Posts are visible to **all signed-in active ZION users**, not anonymous internet visitors. These are public community posts, not private encrypted friend messages. The existing private chat/reels/community features remain separate. Feed uses 20-row keyset pages and videos load on demand, not autoplay.

New RPCs derive identity from auth.uid(). Publishing checks ownership, allowed media, size and a 10-second post interval. Banned profiles cannot use the new feed RPCs or storage policies. Owners and existing database admins can delete posts; no client-selected admin flag is trusted. No comments or report queue were added in this version.

Cancelled/failed attempts may leave unreferenced owned uploads in the private zion-feed bucket. They are not published. A storage lifecycle cleanup job is not included. Signed media links expire after one hour; refresh the feed to renew them.

## Pull-cord lights

Pull down at least 24px or tap/click/press Enter on the cord to change the existing day/dark theme. The cord swings on release. Theme persists using the existing zion-theme preference, and settings stay in sync. Reduced-motion preferences suppress the swing. The control is hidden in the full-screen game to keep aiming unobstructed.

## Forest game: substantial remaining limits

The /city route is retained for old links, but now contains Forest Outpost instead of city blocks/traffic. /forest still forwards to this game. Forest trails, instanced tree canopies/trunks, rocks and cabins, four lightweight vehicles, six patrol characters and three animals. A rifle crate is near spawn; medical crates restore health. Contact with patrols damages health; Respawn restarts at spawn. Drag the scene to turn/aim, use WASD/arrows or touch buttons to move, F/Fire to shoot, R to reload, E to enter a vehicle.

The giant-character bug was addressed by keeping the gameplay root unscaled and using a fixed 1.15 scale on the animated visual only. The actual GLB was tested across 12 animation frames/world positions to verify human-scale bounds.

Heavy CarConcept imports are no longer loaded by the game. Balanced mode disables dynamic shadows and uses 1x resolution, with adaptive reduction on slow frames. Trees are instanced. High detail enables shadows. Assets from V66 remain in the ZIP for compatibility, but the game does not request the heavy car GLB.

This is still a **procedural forest prototype**, not photorealistic PUBG/Free Fire. There is no battle royale lobby, shrinking zone, competitive anti-cheat or server-authoritative PvP. Existing four-player friend exploration/username/vehicle-position sync remains; NPCs, loot and health are local. The prior V63 SQL remains required for friend rooms. Do not advertise this as working online combat.

## Validation and deployment checks

Production compilation/type check and existing 26 invite/meeting/game assertions pass. Added model regression test: `node tests/v67-model.mjs`. ZIP integrity checked before delivery.

Live Supabase migration, two-account feed access/storage and physical iPhone/Android performance were not verified here. Browser local preview was unavailable in this environment; no visual/FPS guarantee is made.

After migration/deployment, use two accounts to verify A's post is visible to B, B cannot delete A's post, likes persist, photos/video load, and the banned account cannot publish. Check feed pagination, cancel/retry and theme drag/keyboard interaction on phone and PC. Then test forest movement, character scale, gun pickup, health and existing friend-room joining. Existing LiveKit credential settings are unchanged.
