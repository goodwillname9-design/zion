# ZION V82 — CEO-only online count, reliable calls, smoother city, ZION Park

Base: your uploaded V79/V80 project (your uncommitted V80/V81 work is untouched).

## What changed
1. **Online count is CEO-only.** Every signed-in account sends a quiet heartbeat (`zion_online_ping`), but only the CEO
   account (`fd62030e-…`, mubieeyy) can read the number — enforced in the database, not just hidden in the UI.
2. **Typing no longer jumps to one side.** Cause: Arabic mode sets `dir="rtl"` + `text-align:right` on every text box.
   Inputs now use `dir="auto"` / `text-align:start`, so English stays left and Arabic goes right by itself.
3. **Calls connect on more networks.** Private calls used Google STUN only (fails on many mobile networks). They now
   load ICE servers from `/api/ice-servers`, which adds a **TURN relay** when you configure one (see below). A short
   network blip (`disconnected`) no longer ends the call instantly (10 s grace). LiveKit meetings use adaptive
   streaming + dynacast + simulcast for big rooms, and the token route caches its credential check for 5 min.
4. **City game lag reduced.** Before: every player called the database 4×/second. Now player positions travel over a
   Realtime broadcast channel (5×/s, only when moving) and the authoritative database sync is adaptive
   (250 ms in combat rounds / when the channel is down, 300 ms driving, 600 ms walking, 1.5 s idle).
5. **ZION Park (new, in the city).** A roller coaster (3 laps, chain lift, drops, brakes into the station) and a lit
   Ferris wheel at the south-east grass block (map: red **RIDE**) and west beach (**WHEEL**). Walk to the platform and
   press **E** / "Ride coaster". Train and wheel run on the wall clock, so all players see the same ride.
6. **Hi-tech polish + smoothness.** `app/hitech.css` (neon focus rings, slim scrollbars, tap-delay removal).
   `PerfMode` auto-enables "lite" visuals (no endless animations / blur) on weak phones or data-saver; force with
   `?lite=1` or `?lite=0`.

## Deploy
1. Supabase SQL Editor → run `SUPABASE_V81_CEO_ONLINE.sql` once (needs V79 already applied).
2. Vercel → Settings → Environment Variables (recommended, fixes calls on mobile data). Either:
   - `TURN_URLS` (comma separated, e.g. `turn:host:3478,turns:host:443?transport=tcp`), `TURN_USERNAME`, `TURN_CREDENTIAL`
   - or `ICE_SERVERS_JSON` = a JSON array of `{urls, username, credential}`
   Any TURN provider works (Metered, Twilio, Cloudflare, your own coturn). Without these, calls stay STUN-only.
3. Terminal:
```sh
npm ci
npm run build
git add .
git commit -m "ZION V82"
git push
```
4. Tests: `node --test tests/` (Node 22.18+ or 24; the new tests import `.ts` directly).

## Security notes
- `vercel recovery codes/recovery-codes.txt` is **tracked in git** (and your remote is GitHub). Treat those codes as
  exposed: generate new Vercel recovery codes, then `git rm -r --cached "vercel recovery codes"`. This ZIP leaves the
  folder out and `.gitignore` now lists it.
- `.env.local` is left out of this ZIP (it is already git-ignored). Keep your own copy.

## Validation (what was and was not checked)
Checked: TypeScript type-check passes; all existing tests + new tests pass (track geometry stays above ground, inside
the park block, no self-collision, speeds ≤ 15 m/s, train starts/ends at the station; ICE-server builder).
**Not checked** (no network/browser/database available while building): `next build`, running the site, the SQL
(no Postgres), real calls through TURN, Supabase Realtime quotas under load, and how the coaster looks. Please test:
two accounts for the online badge (only CEO sees it); a call over mobile data with TURN set; the city with 2+
players; the coaster ride. Broadcast adds Realtime messages — check your Supabase Realtime message quota if you
expect crowded worlds. Public worlds are still capped at 20 players per world (database rule); more players get
a new world.
