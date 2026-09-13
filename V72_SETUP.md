# V72 — Public job worlds, careers and text chat

## Included
- Public worlds with a configured cap of 20 players, automatically creating another world when available worlds fill. Private friend rooms remain available. The current implementation polls Supabase and is NOT load-tested for 20 players; no unlimited-player promise.
- Select/change a job during play. All supplied role categories are selectable. Username and role appear on remote-player labels; your identity appears in the HUD.
- Server-stored career savings, XP and levels. All jobs currently share an introductory field assignment: wait 30 seconds and move at least 20 metres from the starting position for $100/25 XP. Police arrests, medical treatment, farming, player trade, salaries and unique role mechanics are NOT implemented. Career savings cannot yet be spent in the equipment shop; that wallet remains separate.
- World text chat (latest 30 messages, three-second refresh, two-second send limit). Authenticated active world membership required. World chat is visible to members, not end-to-end encrypted. No dedicated world-chat report UI added.
- Voice/video kept per your latest request to speak while playing. Existing LiveKit configuration required. Everyone chooses whether to enable microphone/camera.

## Not included
The map remains a fictional forest. Exact world geography, Burj Khalifa, Taj Mahal, Kuwait Towers, Giza pyramids and Kozhikode SM Street models are not implemented. Do not describe this release as a real-life simulator. New traffic, realistic vehicles, construction, economics, maps and landmark assets require further development. Prior upload/privacy tasks remain unresolved where documented in V70.

## Install
Apply SUPABASE_V72_WORLDS_JOBS.sql after V63 and V68 game SQL (V71 call-access function is included). Do NOT reapply old V63/V68 after V72 because they overwrite the new functions. No new environment variables. Maintain matching LiveKit keys for calls.

```sh
npm ci
npm run build
git add app/city app/globals.css public/sw.js SUPABASE_V72_WORLDS_JOBS.sql V72_SETUP.md
git commit -m "ZION V72 public worlds careers and chat"
git push
```

Play: Game → Friends → Join public world → Jobs & world chat. Private rooms use Create private room and share code. Public job worlds are peaceful and cannot start combat rounds. Private combat remains.

Validation: production build and local PostgreSQL-compatible fixture checks for join/roles/timed rewards/chat throttle/call eligibility. No live load, device, microphone or 20-player test performed. World capacities are configuration, not measured performance guarantees.
