# V71 — Forest Outpost squad calls

The existing forest game, four-player friend rooms, rounds and usernames are retained. Adds an optional voice/video squad panel while playing. Each participant joins the call explicitly and enables their own microphone/camera. LiveKit displays account usernames. Minimize keeps the call mounted; leaving the game room unmounts it. This is an addition to the existing game, not a newly built game or graphics overhaul.

Run SUPABASE_V71_GAME_CALL.sql after the existing V63/V68 game migrations. Keep LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET configured for the same project. The server authenticates the user and verifies active game-room membership, host friendship and ban status before issuing a scoped token. Five-minute token expiry limits new joins; it does not forcibly evict an already-connected participant after an external ban. Immediate server-side moderation eviction is not implemented.

## Play
Sign in → game /city → Friends → Create private room. Send the code to accepted friends. They join that room. Each player presses Join squad call and enables microphone/camera if desired. Host can start a round once two players have joined. Up to four game players; no public matchmaking is added.

## VS Code
```sh
npm ci
npm run build
git add app/city app/api/forest-call-token app/globals.css public/sw.js SUPABASE_V71_GAME_CALL.sql V71_SETUP.md
git commit -m "ZION V71 forest squad voice and video"
git push
```

Test with two accounts and two devices after deploying: hear each other, see enabled cameras and names, mute, minimize and leave. Incorrect LiveKit credentials still prevent calls. No real multi-device call test was completed here. Calls use encrypted transport, not claimed verified E2EE. Prior unresolved media-upload and privacy tasks are not claimed fixed by this release.
