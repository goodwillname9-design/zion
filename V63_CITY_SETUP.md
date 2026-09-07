# ZION V63 — Harbour City

Based only on the supplied V60 lineage, retaining the V61/V62 meeting changes. Existing social features, themes, Supabase tables, security migrations and LiveKit handlers are not replaced.

## What is included

- `/city`: original browser 3D city, shaded facades, waterfront, roads, street furniture, pedestrians and background traffic.
- Ten parked vehicles, including two motorcycles; walk near a vehicle and press E / Enter vehicle.
- Five delivery contracts, local game-money balance, a $300 fictional range-equipment shop and target practice. No real payments or real weapon purchasing.
- Minimap, pause, touch controls, landscape layout, fullscreen request, performance preset and automatic pixel-resolution reduction under low frame rates.
- Up to four authenticated players can explore together, with authoritative profile usernames above remote avatars/vehicles.
- Old `/forest` links redirect to `/city`; the Games card points to Harbour City. Old forest source remains as a recoverable reference but is not the playable route.

## Required Supabase step for online rooms

1. Back up the database as usual. Open your existing ZION Supabase project → SQL Editor.
2. Run **SUPABASE_V63_CITY.sql** once, after the existing schema/security updates. It is additive: two new RLS-enabled tables and three scoped RPC functions. It does not reset profiles or change existing permissions.
3. Keep existing Vercel environment variables, including Supabase and LiveKit. No new API key is needed. Never expose a service-role key in browser code.
4. Sign in to ZION. The host opens Games → Harbour City → Friends → Create private room.
5. Copy the room code and send it privately to an **accepted ZION friend**. They sign in on their own device, open the same game, choose Friends, paste the code and join.
6. Both press Back to game / Enter Harbour City. The status must say Online, with the correct player count. Room lifetime is two hours. One active room per user; disconnected slots expire after 30 seconds.

The database controls room membership, maximum occupancy, authenticated sender identity and profile names; banned users cannot join/sync. Non-friends cannot join using a leaked room code. Room codes are not account passwords.

## Online scope and costs

This is **cooperative exploration**, not a finished competitive multiplayer game. Position and vehicle type sync through scoped Supabase RPCs, at most roughly four sequential requests per second per client (slower with latency). Interpolation smooths received motion. This deliberately avoids relying on any permissive pre-existing Realtime channel policies. Requests and database activity consume your Supabase plan limits; unlimited free usage is not promised.

Missions, cash, shop purchases and hits remain local to each browser, including across accounts on that browser. They are fictional, client-editable values, not a secure competitive economy. NPC/traffic simulation and parked vehicles are local: there is no shared vehicle ownership, collision/damage, PvP, shared missions, game voice integration or authoritative physics server. Background traffic is decorative and can pass through players. Remote motorcycle rider animation is not supplied. These require a further multiplayer simulation stage.

## Controls

WASD/arrows: move/steer. Shift: run on foot. Space: brake. E: enter/exit nearby vehicle. B: range shop. F: target practice. Escape: pause. Touch buttons provide the same actions. The shop is **S** on the map; face the target boards near it before firing.

Fullscreen is requested only after tapping its button. Browsers that reject fullscreen/orientation lock show a rotate-device hint; there is no promise of forcing iPhone Safari orientation. Portrait remains usable. Switch to Performance if the device struggles. No zero-lag guarantee.

## Visual honesty

All geometry/textures are original procedural assets. No GTA/Rockstar assets are included. These are more detailed prototype models, **not photorealistic or GTA 5-quality art**. Licensed realistic models, richer animation, audio, stronger physics and a dedicated simulation are still needed for that goal.

## Deploy from VS Code

Extract this complete ZIP into your existing local ZION repository. Preserve your local environment values and Git history; do not commit secret environment files. Then run:

```bash
npm ci
npm run build
git status
git add app/city app/forest/page.tsx app/friend-games.tsx public/sw.js SUPABASE_V63_CITY.sql V63_CITY_SETUP.md
git commit -m "Add Harbour City adventure and private friend rooms"
git push
```

Vercel deploys the pushed commit. If updating from earlier than V62, review and stage the other intended files too; this command lists V63 changes only. Do not run account-reset SQL. No change to LIVEKIT_API_SECRET, LIVEKIT_API_KEY or LIVEKIT_URL is required by this game update.

## Verification and acceptance

Production build and TypeScript checks passed. Scoped ESLint passed with no warnings; seven save/mission assertions passed. Browser visual testing was blocked by the Chromium download timeout/access failure, so no rendered screenshots or real-device performance results are claimed. Live Supabase multiplayer cannot be certified without applying the migration to your project and testing two separate accounts/devices. Before public launch, verify: non-friend denied; fifth player denied; duplicate tabs do not create extra players; ban/removal blocks sync; names/positions visible on both devices; leave/rejoin works; 2-hour expiry; stale participants disappear. Test iPhone, Android, tablet and desktop hardware for frame rate and touch usability.

The implementation does not constitute a full security audit of historical ZION code. No external deployment, SQL execution, asset purchase or service provisioning was performed for this ZIP.
