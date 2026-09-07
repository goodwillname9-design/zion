# V64 — game invitations, auto-launch and meeting diagnostics

Complete update based on V63. Existing Harbour City, social, admin and LiveKit features retained. No live deployment or database changes were executed here.

## Supabase — required for duplicate prevention

Run `SUPABASE_V64_INVITES.sql` in your existing project's SQL Editor after taking a backup. It retains one pending invitation for each sender/game/participant set, marks extra pending copies declined (does not delete records), and adds a unique partial index to block duplicate submissions including simultaneous tabs. Existing active/finished games are not changed. The SQL is repeatable.

Frontend filtering also removes duplicate pending invitations from the notification list, game list and unread-game count. Double-click submission locks and friendly already-sent feedback cover Invite and Play Again. The sender does not receive their own invite alert.

## Automatic game opening

While the ZION social screen is open, accepted pending invitations are tracked. Once a game becomes active, the inviter and accepted participants are routed into it. Two-player games start when the friend accepts; group Ludo waits for everyone. Realtime is backed by a foreground 3-second poll, plus a local sent event for fast acceptance. Active games do not repeatedly reopen after each move. This does not launch a closed app or interrupt a separate route such as Harbour City.

## Meeting error — action in Vercel may still be necessary

The reported error is a rejected LiveKit token, not a wrong meeting password. The updated server trims surrounding whitespace/quotes from LiveKit settings, validates the URL, and checks the server's read-only ListRooms API using a short-lived server token before issuing a participant token. Secrets stay server-side. Failures distinguish rejected credentials, invalid configuration and unreachable service. User-chosen passwords and invitation copying are retained.

If credentials are rejected:

1. Open the LiveKit project you intend to use. Copy its project URL and a matching API key/secret pair.
2. In **Vercel → ZION → Settings → Environment Variables**, edit the three exact keys:
   - `LIVEKIT_URL`: actual `wss://...livekit.cloud` project URL.
   - `LIVEKIT_API_KEY`: the API key value from that same project.
   - `LIVEKIT_API_SECRET`: its matching secret, not a meeting password or access token.
3. Select the environment you deploy to (Production; Preview too if using preview deployments). Existing wrong variables must be edited, not given unrelated names.
4. Redeploy and reopen the site. No git commit is needed merely to change Vercel variables, but source changes below must be deployed too.

Do not send API secrets in chat or screenshots. There is no automatic way to repair a mismatched/revoked key without changing deployment credentials. Preflight does not prove camera/microphone media connectivity. HMAC-based meeting room selection remains unchanged; an incorrect meeting password selects a different room rather than querying a persistent meeting-password registry.

Official protocol reference: https://docs.livekit.io/reference/other/roomservice-api/

## VS Code

Extract this complete ZIP into your existing ZION repository, preserving your local environment secrets and Git history. Then:

```bash
npm ci
node tests/v64.cjs
npm run build
git add app/friend-games.tsx app/social-shell.tsx app/meeting-room.tsx app/api/livekit-token/route.ts lib/game-invites.ts lib/use-game-launch.ts lib/livekit-config.ts public/sw.js SUPABASE_V64_INVITES.sql V64_SETUP.md tests/v64.cjs
git commit -m "Fix duplicate game invites, auto-launch and meeting configuration"
git push
```

This stages V64 changes over V63. If updating from an older version, review and stage its intended changes too. Do not run account-reset SQL.

## Verification boundaries

Production build/TypeScript and the included 17 regression assertions are checked during preparation. Existing whole-app lint findings are not claimed resolved. Live Supabase migration, two-account acceptance and actual LiveKit credentials must still be tested in your deployment; no real-device/live-service success is claimed.

Check: repeat invite clicks produce one pending notification; another game or player group remains distinct; decline permits a fresh invitation; acceptance opens both games; group games wait for every accept; moves do not reopen a closed game. Meeting create/join should either connect or return the specific configuration/network error. These fixes are scoped to the screenshots, not a full historical notification/security audit.
