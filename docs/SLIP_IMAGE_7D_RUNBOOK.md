# Private bank-slip evidence — deployment & operations runbook

Feature: iPhone Image Upload → OCR → 7-day Private Storage → Review Inbox → keep ledger and delete original image. Legacy text-only Photos automation remains supported.

## Current environment

- Supabase: **money-tracker**, Singapore, \`ruwpkdghcdnzulpgnzpm\`. Private bucket \`money-tracker-slip-temp\`, max 3 MiB, MIME JPEG/PNG/WebP, \`public=false\`.
- Vercel API project \`money-tracker-api\`; intended Production domain \`https://money-tracker-api-blush.vercel.app\`, separate from protected web project \`money-tracker\`.
- Schema migration \`20261010170000_slip_image_retention.sql\` has been applied. Bucket created; no existing financial rows modified.
- Scheduler extensions \`pg_cron\` + \`pg_net\` installed, token stored as Supabase Vault secret **money_tracker_slip_cleanup_token**; matching Vercel Production environment variable **SLIP_CLEANUP_SECRET**. The hourly job \`money-tracker-slip-expiry-hourly\` is currently **inactive pending approved deployment**.
- GitHub branch \`feat/slip-image-retention-7d-20261010\`, PR #8. The current Vercel Hobby account exceeded its per-day API deployment quota (402 on Oct 10). **Do not claim live end-to-end tests or enable Cron until a new deploy is successful.** Do not buy/upgrade plans without explicit approval.

## Safe activation (order is mandatory)

1. Wait until Vercel free daily deployment quota resets; keep original project's protection settings unchanged.
2. Ensure GitHub CI \`pnpm test\`, \`pnpm build\` and UX/UI Audit PASS. Review PR #8 and the branch.
3. Deploy API project from approved branch, supplying Production secrets \`IPHONE_UPLOAD_TOKEN\`, \`IPHONE_REVIEW_TOKEN\`, \`SUPABASE_SERVICE_ROLE_KEY\`, \`SUPABASE_URL\`, \`IPHONE_ALLOWED_APP_ORIGIN\`, \`SLIP_CLEANUP_SECRET\`. All sensitive variables server-only, never \`VITE_\` prefix.
4. Test \`GET /api/iphone/image\` without browser Origin → 403, \`POST /api/iphone/upload\` with invalid bearer → 401, \`POST /api/iphone/cleanup\` with wrong bearer → 401. These are *negative smoke tests*, not end-to-end proof.
5. Upload a **synthetic/consented** small test slip over multipart (JWT not required, upload bearer required) → \`202 pending\`. Inspect bucket: private object exists, draft \`image_status=available\`, \`image_expires_at=image_uploaded_at+168 hours\`. Repeat upload → \`200 duplicate\`.
6. Deploy web project with approved main or branch containing \`src/IPhoneShortcutSettings.tsx\`, \`src/IPhoneSlipPreview.tsx\`, \`src/lib/iphoneSync.ts\` and Production \`VITE_IPHONE_BRIDGE_URL=https://money-tracker-api-blush.vercel.app\`. Set browser **Review Token** locally in Settings. Open review on iPhone Safari, verify image zoom and Thai amount/date; confirm/discard. Assert ledger exactly one item, financial data survives picture removal. Confirm no screenshot in public response/URL.
7. Test expiry using a **separate synthetic row** with manually backdated \`image_expires_at\` (never real user data): image endpoint must return 410 and *never fetch blob*. Test cleanup with proper Vault credential, verify physical object removed via Storage API and DB \`image_status=deleted\`.
8. Review bucket public=false and RLS anon/authenticated cannot read; run any security advisors. Verify iPhone Shortcuts Share Sheet JPEG under 3 MiB. Text-only Photos automation must create no Storage objects.
9. Only after end-to-end success **activate hourly Cron**:
   \`\`\`sql
   select cron.alter_job(
     (select jobid from cron.job where jobname='money-tracker-slip-expiry-hourly'),
     active := true
   );
   \`\`\`
   Verify \`cron.job\` shows active=true and \`cron.job_run_details\` / \`net._http_response\` show successful responses after first interval. Report cleanup backlog regularly.
10. Enable alerting for failed API calls or \`image_status='delete_failed'\`, and check any retained objects older than 8 days; see cleanup recovery below.

## Safety / recovery

- Every image GET checks timestamp against server now; expiry is immediate at exactly 168h even before physical blob deletion.
- Actual blob deletion occurs on the **next successful scheduled cleanup**; if scheduler/network is down, it can take longer. Never promise physical deletion at precisely 168h.
- Scheduler uses Vault secret. Never commit plaintext secrets into repository or migrations. Rotate in Vault and Vercel in a coordinated action.
- Storage API remove is required; do **not** directly DELETE from \`storage.objects\`.
- If cleanup fails, check Vercel logs for \`/api/iphone/cleanup\` (do not log sensitive contents); monitor \`image_delete_attempts\` and sanitized \`image_last_error_code\`.
- Do not delete confirmed/structured records, only the blob and its private path. Existing IndexedDB remains one-way. The web app's generic privacy messaging must accurately describe optional cloud image uploads.
- To roll back: pause Cron, roll back API/web Vercel deployments, retain additive schema; run safe image deletion manually if needed. Do not remove bucket while valid pending photos remain.
- If free-tier quotas prevent deploy, keep Cron paused and feature disabled until deploys can pass tests.
