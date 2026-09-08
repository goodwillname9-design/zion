# ZION V66 — model integration and message timestamps

This is a complete source ZIP based on the V65/V60 project lineage. It is a partial graphics upgrade, not a finished photorealistic game.

## Changes

- Local, licensed CarConcept GLB with detailed body, interior and glass; near cars use it, distant cars use the existing low-cost geometry. Wheel pivots animate. High detail increases detailed-model distance and resolution. Balanced/Performance retain distance LOD.
- Animated, skinned Cesium Man sample replaces block people. Each person has a separate skeleton/mixer. It is NOT a photoreal civilian; original logo/credits retained.
- Asphalt and concrete PBR maps, separate instanced glass windows, reflection environment, antialiasing. Automatic resolution no longer degrades below 1x after low-FPS sampling.
- Existing driving, gun, ammo, nine missions, four-player friend room and usernames retained. NPC hit lookup now accepts nested skeletal meshes.
- Every friend chat message, including text/photo/video/voice/view-once/deleted messages, displays its persisted send time. Community and stranger chats also show send time. Time uses the reader's device timezone and locale; hover exposes full date/time. Existing ticks remain adjacent. Message actions now occupy their own wrapping footer so they do not cover audio playback.
- Service-worker shell version incremented to V66.

## Deploy in your existing VS Code Git checkout

Back up your checkout, then copy the extracted ZIP contents into your existing ZION project folder. Preserve your local environment file and your Git directory. Do not copy `node_modules` from an older build.

```bash
npm ci
npm run build
git add app/city/city-game.tsx app/message-time.tsx app/social-shell.tsx app/experience.tsx app/globals.css public/sw.js public/game-assets ASSET_CREDITS.md V66_SETUP.md
git commit -m "ZION V66: integrate game models and show chat send times"
git push
```

Vercel: let the connected repository deployment finish. No NEW environment variables are introduced by V66. Keep the existing Supabase and LiveKit settings. If Vercel is not connected to Git, deploy the project using your established workflow. After deployment, close/reopen an installed PWA or reload the website to load the new shell.

Supabase: NO NEW SQL is required for V66. Existing `created_at` values supply timestamps. Keep your existing schema/RLS. Earlier multiplayer prerequisites (`SUPABASE_V63_CITY.sql`) and invitation fix (`SUPABASE_V64_INVITES.sql`) are still included for installations that have not applied them; do not reset the database.

## Remaining limits

- Buildings, bikes, animals and distant car geometry are still prototypes. No photorealistic asset pack or real Kuwait map is included. The city is NOT GTA-level graphics.
- Multiplayer still synchronizes friend positions/vehicle types/usernames, not authoritative shared combat, NPCs or economy. This release does not claim otherwise.
- LiveKit credential rejection still requires the correct matching URL/key/secret from the same project in Vercel. This graphics/timestamp update cannot manufacture those credentials.
- No zero-lag guarantee. High detail is more GPU-intensive; use Balanced/Performance on mobile. Physical iPhone, Android, tablet and PC testing remains required.

## Validation

TypeScript check and the existing 26 invitation/meeting/mission assertions passed during development. Production build passed (Next.js 16.3.3). GLB geometry/animation structures were parsed offline and model dimensions checked.

The available preview browser rejected the local preview URL (`ERR_BLOCKED_BY_CLIENT`), so actual visual rendering, real-device performance and two-account online play were NOT verified in this session. Do not interpret a passing build as visual QA.

Before production use: open /city, verify detailed cars load at close range, walk/enter/exit/drive, check NPC animation and shots, test both graphics modes, rotate a phone, and join the same friend room on two accounts. In chat, send text/voice/photo, refresh, and confirm timestamps remain unchanged and controls do not overlap. Retain `ASSET_CREDITS.md` and the bundled source notices when distributing the project.
