# Money Tracker — Batch E–G implementation & release gates (2026-10-10)

## Scope & source of truth
Work branch: `feat/mobile-first-audit-a-d-20261010`, based on `feat/slip-image-retention-7d-20261010`. PR #9 targets `main`. Do not confuse locally built app, GitHub main, protected Vercel previews, the public web alias or the separate API project.

## Batch E — Financial safety and private slip retention
- Added `potentialCrossChannelDuplicates`, an **advisory heuristic** for equal direction, satang amount, date and method, comparing LINE vs iPhone imported IDs. It intentionally never silently discards or deduplicates financial records: equal amounts can be legitimate distinct transfers.
- iPhone review requires explicit direction and date (from Batch A). When local LINE transactions potentially match an iPhone draft, the user must explicitly acknowledge reviewing the original before confirming.
- LINE imports display a possible-duplicate count rather than hiding financial records.
- Retention UX no longer promises blob deletion precisely after 7 days: photo access expires at 168 hours, but actual private-object deletion needs working hourly cleanup.
- Read-only Supabase audit on 2026-10-10: `public.money_tracker_iphone_drafts` RLS enabled; 0 public policies, 0 drafts, 0 objects in `money-tracker-slip-temp`, 0 expired paths/deletion errors. Private bucket access must be rechecked on deployed API.
- **Cron `money-tracker-slip-expiry-hourly` remains disabled**. Do NOT enable until API/web deploy, image-auth negative smoke, real synthetic upload, expiry, physical Storage API delete and Cron response checks pass.

## Batch F — Mobile UX
- Dedicated Inbox distinguishes loading, truly empty, and failed connection states.
- Home mobile item order: monthly net → quick actions → pending review → recent transactions → budget → reports.
- Settings header uses Back icon on Settings page.
- Typography and financial field controls scaled for mobile, visible duplicate warnings, date of latest local backup displayed.
- Slip zoom traps keyboard focus on close, handles Escape, restores focus/body scrolling.
- Manual scanner now accepts HEIC/HEIF on iOS Safari 17+ and converts locally to JPEG before OCR; unsupported browsers show a bounded-time error with a JPG alternative. Actual iPhone Safari, Shortcuts and VoiceOver remain manual test gates. The separate API upload intentionally still accepts only JPEG/PNG/WebP.

## Batch G — QA
- `tests/crossChannelDuplicates.test.ts`: conservative amount+type+date matching, no mutation, no guessed direction.
- `scripts/ux-audit.mjs`: local synthetic iPhone bridge with CORS, bank slip draft, protected image, zoom/Escape and explicit direction/date review. Does not contact real bank or API.
- `.github/workflows/ux-audit.yml`: Thai Noto + TLWG fonts installed before Chromium screenshots to address Thai square-glyph evidence gap.
- Device matrix 320/375/390/430/768/1280 and axe-core; CI workflow builds + unit tests.

## Release gate (production must remain unchanged until all true)
1. Web CI and Chromium/axe audit pass on the **exact approved commit** (check Actions, do not infer from older commits).
2. Vercel deployment quota/access allows both API and web **new previews** of the same intended commit; inspect Vercel project/domain alias and build output.
3. Negative security smoke: anonymous/invalid Origin access rejected, invalid upload/review/cleanup bearer rejected, image URLs are private, no raw token in browser logs.
4. Synthetic image E2E: upload → OCR/draft → confirm/discard → local import **exactly once** → immediate expiry-denied access → authenticated blob cleanup → database marks deleted.
5. Enable hourly Supabase Cron only after 4, verify `cron.job_run_details` & Storage state, and add failed-deletion alerts.
6. Real iPhone Safari/VoiceOver, banking app close-trigger/Shortcuts, Thai slip OCR and 320px keyboard/Zoom QA.
7. Merge PR / promote only after approved checks; do not upgrade Vercel, change paid plan, disable protection or make an untested deployment to bypass limits.

**Known external blocker on 2026-10-10:** Vercel create deployment returned HTTP 402 `api-deployments-free-per-day`, meaning no fresh preview of final commit. Older failed previews were from intermediate commits. Do not equate successful GitHub TypeScript Build with a deployed Vercel preview.

## Batch H — iPhone HEIC and live API smoke gate
- `src/lib/slipImage.ts` performs native Safari/WebKit HEIC/HEIF decoding and local canvas → JPEG conversion; no conversion cloud endpoint or additional npm dependency. File size limited to 10 MiB, output long edge max 2,600px, and decode has a 6-second failure timeout.
- `tests/slipImage.test.ts` verifies type detection, size, downscale, JPEG passthrough, simulated successful native decode and explicit unsupported-browser fallback.
- `scripts/ux-audit.mjs` exercises an unsupported synthetic HEIC in Chromium, ensuring a visible error instead of a hung OCR flow.
- `scripts/release-api-smoke.mjs` and manual `.github/workflows/api-negative-smoke.yml` verify anonymous/invalid-Origin/invalid-token responses using only fake tokens and no uploaded files, recording sanitized status evidence. They must be run **after** an approved API deployment; do not mark green based on source tests.
- Vercel Production environment variable **names** are present for Web `VITE_IPHONE_BRIDGE_URL` and API `SLIP_CLEANUP_SECRET`, `IPHONE_REVIEW_TOKEN`, `IPHONE_UPLOAD_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `IPHONE_ALLOWED_APP_ORIGIN`. They are not configured for Preview, so a Preview/API E2E needs separately scoped credentials and allowed origin, not a blind production-secret copy.
- `money-tracker-slip-expiry-hourly` remains **inactive** until a safe synthetic full-cycle E2E verifies physical deletion. Production aliases must not be updated until the deployment itself is verified.

