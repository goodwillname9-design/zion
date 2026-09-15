# ZION V79 — Online now

Complete V78 base. Side badge displays the real number of signed-in, non-banned accounts whose foreground browser reported activity in the last 90 seconds. No artificial starting count. Each account has one presence row, so multiple tabs/devices on the same account count once. This is a recent-activity estimate, not an instantaneous socket count. Background tabs stop heartbeats; leaving expires within 90 seconds, visible counts refresh every 30 seconds. Logged-out visitors are not counted.

Only an aggregate count is exposed to authenticated active accounts. Presence rows cannot be read directly by clients. Existing show-online-status privacy setting for friend presence is unchanged; this aggregate reveals no usernames. No badge is shown on database errors or before setup, rather than showing a false zero. Badge is hidden during game and meeting pages; presence still reports while visible. Calls/media upload are unchanged.

## Deploy
1. Supabase SQL Editor: run SUPABASE_V79_ONLINE.sql once.
2. Replace the existing project files with the complete ZIP. Keep existing keys.
3. VS Code terminal:
```sh
npm ci
npm run build
git add .
git commit -m "ZION V79 actual online account count"
git push
```
4. After Vercel Production is Ready, reopen ZION. Use two different accounts to check the count. A second tab on one account should not increase it. Close one account's tabs and allow up to 120 seconds for expiry plus the other screen's next refresh.

## Validation
Production build passed. Local PGlite tests passed for distinct account counting, repeat heartbeat deduplication, 90-second expiry, banned/anonymous rejection and denial of direct presence table access. Physical device/multiple authenticated production sessions not tested.
