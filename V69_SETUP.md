# V69 media upload fix

Fixes duplicate Authorization and apikey headers in the shared resumable uploader. Browser XMLHttpRequest appends repeated header values; this corrupted upload authentication and could produce Invalid Compact JWS for photos, videos and voice notes. Headers are now applied once per request, including refreshed credentials.

No new SQL or environment variable changes for this fix. Previous V68 requirements still apply, including its server-only key and privacy migration for opening view-once media. Do not reset accounts or disable RLS.

Replace project files, then run:

```sh
npm ci
npm run build
git add lib/resumable-upload.ts public/sw.js tests/v69-upload.cjs V69_SETUP.md
git commit -m "Fix duplicate media upload authentication headers"
git push
```

After Vercel finishes deploying, close and reopen ZION, then retry a small photo, video and voice note. Test view-once with a second account. This release was checked with a header regression test and production build; live device/storage delivery is not verified here.
