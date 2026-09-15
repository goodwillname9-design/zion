# ZION V78 — Loading improvements

Complete V77 base preserved. No new SQL or environment variables required.

Changes:
- Feed, games and reels use on-demand code loading instead of being bundled eagerly into the social shell.
- Initial profile request no longer repeats for INITIAL_SESSION. Token refresh does not restart the profile loading screen. Local encryption identity lookup runs concurrently with the profile request.
- Normal media requests share duplicate queued work and run at most three at a time. View-once media remains excluded from background prefetch.
- Media metadata is decrypted when its download worker needs it, rather than delaying text rendering.
- Completed media is reused within the open conversation. Stale in-flight work cannot publish object URLs after channel cleanup.
- Read-only message updates use a local update when the realtime old-row payload supplies enough information; other updates retain a full refresh.

Validation: production build passed; V78 pool tests passed (concurrency limit, duplicate sharing, recovery after errors); V76 view-once and V69 upload regression tests passed.

Limits: this is a code-level optimization, not a measured real-device speed benchmark. No authenticated production/physical phone testing was performed. Network latency, server response time and device performance still affect speed. First opening a deferred feature may require fetching its code. No zero-lag guarantee.

Deploy:
1. Replace the files in your existing ZION project with this complete ZIP.
2. Keep the working Vercel keys and existing database migrations.
3. Run in your project terminal:

```sh
npm ci
npm run build
git add app/social-shell.tsx lib/task-pool.ts public/sw.js tests/v78-pool.cjs V78_SETUP.md
git commit -m "ZION V78 reduce startup and media loading work"
git push
```

Wait for Vercel Production to show Ready. Close and reopen ZION. Test initial opening, friends list, media-rich conversation, Reels, game opening and one new view-once photo with a second account.
