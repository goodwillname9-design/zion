# ZION V57 production checklist

## Required deployment order

1. Back up the Supabase database.
2. Run `SUPABASE_V57_SECURITY.sql` once in the Supabase SQL Editor.
3. Confirm the CEO auth UUID in that migration is the intended owner account.
4. Deploy the application to Vercel with the existing Supabase and LiveKit environment variables.
   Required meeting variables are `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`. Keep the API secret server-side only.
5. In Supabase, schedule `select public.cleanup_zion_operational_data();` at least hourly using Cron. Storage lifecycle deletion should separately remove expired story objects.
6. Enable Supabase daily backups/PITR as supported by the project plan, then perform a restore drill in a separate test project.

## Security verification

- A normal account cannot update `is_admin`, `is_banned`, `ban_reason`, or `follower_base_count`.
- Only the fixed CEO UUID can call `moderate_zion_profile` successfully.
- Opening a view-once photo succeeds once for the recipient. A second signed-URL request is denied. The short delivery URL expires after 30 seconds.
- Do not market calls as independently verified E2EE. Current calls and LiveKit rooms use encrypted WebRTC transport. Application-layer E2EE requires a separate implementation and security review.
- Report/block actions must be tested between two non-admin accounts and reviewed from the CEO account.

## Real-device release matrix

Test on an actual iPhone with a notch, Safari; Android Chrome; Windows Chrome/Edge; and macOS Safari/Chrome. For each device verify login refresh/back persistence, notification count after opening Notifications, chat initial load/order/scroll, upload cancel/retry/progress, game voice join/leave, reels pagination, story upload, and keyboard/safe-area alignment.

## Upload and reliability checks

- Test a small file, a file over 8 MB, a network interruption and Cancel.
- Large uploads use resumable TUS retries when available. Actual maximum size still depends on the Supabase Storage project limit and upstream hosting limits.
- Review `zion_error_logs` without copying message or media content into logs. Logs older than 30 days are removed by the cleanup job.
