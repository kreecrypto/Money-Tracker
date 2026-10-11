# Money Tracker — Release Gate and staged QA evidence (2026-10-11)

## Scope and hard stop
- Source branch: `feat/mobile-first-audit-a-d-20261010`; PR #9 is **DRAFT**. Do not merge or promote while any gate is unverified.
- Production `money-tracker` web and `money-tracker-api` aliases must remain on previously deployed versions.
- Supabase production project `ruwpkdghcdnzulpgnzpm` is **not** a preview database. Do not reuse its service-role key or run synthetic write/delete E2E against user data.
- Never enable `cron.jobname='money-tracker-slip-expiry-hourly'` until isolated live image E2E confirms physical deletion and alerts.

## Stage 1 — Preview environment (PARTIAL PASS)
On 2026-10-11, Vercel has branch-scoped **Preview-only** env vars:
- Web `money-tracker`: `VITE_IPHONE_BRIDGE_URL` points to stable `money-tracker-api` feature-branch preview alias.
- API `money-tracker-api`: `IPHONE_UPLOAD_TOKEN`, `IPHONE_REVIEW_TOKEN`, `SLIP_CLEANUP_SECRET` are independent generated QA-only secrets; `IPHONE_ALLOWED_APP_ORIGIN` matches stable web feature-branch alias.
- No Supabase key/URL is present on Preview, deliberately fail-closed. The Preview API is **NOT connected** to database/storage. Do not show a QA-only screenshot as proof of a full upload flow.
- Vercel Authentication remains on. Do not disable protection. For protected CI, use Vercel's `x-vercel-protection-bypass` header with secret held only in a GitHub Actions secret, never committed or shared in logs.
- No chargeable Supabase preview branch was provisioned. Supabase branching may incur compute charges and would require separate authorization.

## Stage 2 — API Security (PARTIAL PASS)
Vercel Preview API responses checked with read-only GET:
- `/api/iphone/image` without Origin: **403** `ORIGIN_DENIED`.
- `/api/iphone/drafts` without Origin: **403** `ORIGIN_DENIED`.
- `GET /api/iphone/upload`: **405**.
- `GET /api/iphone/cleanup`: **405**.
Outstanding: actual HTTP POST negative tests with anonymous/bogus 64-hex bearer, and OPTIONS untrusted Origin, using the **same exact approved preview commit**.
- Script: `scripts/release-api-smoke.mjs`; explicit `RELEASE_API_BASE_URL` and `RELEASE_APP_ORIGIN` required. It checks both JSON API error codes and status, avoiding false-green Vercel login responses.
- Manual workflow: `.github/workflows/api-negative-smoke.yml`. Optionally set GitHub secret `MONEY_TRACKER_API_PREVIEW_BYPASS` through GitHub UI to test protected API; do **not** paste the secret in repo, PR or a chat.
- Workflow inputs for the intended branch:
  - `api_base_url`: `https://money-tracker-api-git-feat-0dc0ed-kreetaphongame-3572s-projects.vercel.app`
  - `web_origin`: `https://money-tracker-git-feat-mob-91aa1e-kreetaphongame-3572s-projects.vercel.app`

## Stage 3 — Private-slip full E2E (BLOCKED)
Required on a separate isolated Supabase QA environment:
1. Apply repository additive migration and create private `money-tracker-slip-temp` bucket with storage restrictions.
2. Set Preview `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to QA-only values. Rebuild same branch on both Vercel projects.
3. Synthetic JPEG under 3 MiB with valid upload bearer → 202 pending; duplicate upload → 200 without duplicating rows.
4. Verify OCR review fields and explicit direction/date, confirm and discard paths, exact-once local import.
5. Private image GET: correct review token/origin 200; unauthorized bearer 401; expired image 410.
6. Backdate only a **synthetic QA row**, invoke separately authenticated cleanup, verify physical Storage API object deletion and `image_status=deleted`; no real financial data touched.
7. Check no sensitive token or storage path leaks; re-check anon/authenticated RLS/Storage no access.
8. Test cleanup recovery/alerts, review time-to-delete contract. Only after ALL checks, consider production scheduler activation.

## Stage 4 — iPhone QA (AUTOMATED PARTIAL / PHYSICAL BLOCKED)
- Existing Chromium UX/UI Audit: six responsive widths, synthetic slip review, zoom, focus and axe checks.
- Additional `scripts/iphone-webkit-smoke.mjs` and `.github/workflows/iphone-webkit-smoke.yml`: WebKit-on-Linux emulation, 320/390/430px, scan modal/HEIC fallback/Inbox and client JS error checks; does **not** claim real iOS 26.
- Manual QA on an actual iPhone iOS 26: Safari Share Sheet, Shortcuts Convert Image to JPEG (if HEIC), upload with proper token, reviewing OCR Thai amount/date/direction, duplicate prevention, accessibility/VoiceOver, keyboard/safe area, background automation limitations. Use synthetic/consented slips only.
- Record per-device screenshots, device model, iOS version, expected/actual behavior, and PASS/FAIL.

## Stage 5 — Production (BLOCKED)
Require prior 4 stages fully green, exact SHA CI + UX Audit + WebKit pass, manual reviewer sign-off:
- Stage a production-targeted build with `--skip-domain`, validate with production configs **without** sending a synthetic financial row to actual customer data.
- Promote the **tested** production build, verify both production aliases and negative security smoke.
- Activate hourly cleanup only after live deletion proof, with failure alerts and verification of `cron.job_run_details`.
- Rollback recipe: pause cleanup cron, rollback web/API aliases to recorded previous READY deployments, keep additive DB schema.

## Live project read-only snapshot, 2026-10-11
- Money Tracker Supabase: `money_tracker_iphone_drafts` RLS on, 0 public policies, 0 drafts; Storage bucket `public=false`, 0 objects.
- `money-tracker-slip-expiry-hourly`: `active=false`.
- No paid account, project protection, service-role key, database rows, storage objects or production alias has been changed by this release-gate work.
- **Never label this feature production-ready until all blocked gates are closed.**
