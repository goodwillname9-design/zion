# V76 — View-once opening repair

Server first verifies the recipient and downloads the encrypted file into server memory. Only after successful download does the existing atomic claim consume access; only the winning request receives bytes. Storage download failure no longer consumes the item. Concurrent requests still cannot both obtain it. Storage removal exceptions no longer suppress a downloaded, claimed response. No direct storage URL is exposed.

Client blocks duplicate taps, shows Opening, refreshes an expiring session, checks encrypted metadata before requesting delivery and displays distinct safe error codes. Timed close revokes the object URL. Numeric-string message IDs are accepted safely.

No new SQL or variables. Existing SUPABASE_V68_PRIVACY.sql and server-only SUPABASE_SERVICE_ROLE_KEY remain required. Never expose this key through NEXT_PUBLIC_ or Git. ONCE_CONFIG means missing server configuration; ONCE_STORAGE means the server could not download the object; ONCE_MIGRATION indicates a missing/inaccessible claim RPC; ONCE_KEY indicates local decryption metadata could not be unlocked. Follow the actual code shown rather than resetting accounts.

This does not recover media already consumed by older versions. If the network or local decryption fails AFTER atomic claim, media can still be consumed without successful viewing. Retrying consumed media would break view-once guarantees; ask the sender for a fresh item. This is not screenshot prevention.

```sh
npm ci
node tests/v76-once.cjs
npm run build
git add app/api/view-once/route.ts app/social-shell.tsx public/sw.js tests/v76-once.cjs V76_SETUP.md
git commit -m "ZION V76 repair view-once delivery and errors"
git push
```

Validation: production build passed; mocked route tests confirm no claim on storage failure, configuration errors, single concurrent delivery, string IDs and successful delivery despite removal exceptions. Physical iPhone/Android and live Supabase tests were not performed. After deployment send a fresh small photo to a second account and open once; repeat with a video. If an error appears, send its code only, not credentials.
