# Money Tracker — Private Slip Images (7-day TTL) — End-to-End Implementation Plan

**Status:** PLAN ONLY — not yet implemented, migrated, or released.  
**Target:** \`kreecrypto/Money-Tracker\` — iPhone Shortcuts image upload + OCR structured drafts + private 7-day image evidence + reviewer UI + hourly secure deletion.  
**Date:** 2026-10-10. **No production deployment / secrets changed by this plan.**

## 1. Source-of-truth and audited baseline

- GitHub default \`main\` contains \`api/iphone/upload.ts\`, \`api/iphone/photos.ts\`, \`api/iphone/drafts.ts\`, \`api/iphone/ledger.ts\`, \`server/iphone/bridge.ts\`, \`server/iphone/ocr.ts\`, \`src/IPhoneShortcutSettings.tsx\`, and \`src/lib/iphoneSync.ts\`.
- \`POST /api/iphone/upload\` accepts authenticated multipart \`image\` JPEG/PNG/WebP up to **3 MiB**. It OCRs the bytes in-memory, stages structured data in \`money_tracker_iphone_drafts\`, hashes the image, deduplicates; **it does not persist image bytes**.
- \`POST /api/iphone/photos\` is a separate **OCR-text-only** endpoint; retain it without creating blank images or sending unrelated Photos.
- Existing \`GET/POST /api/iphone/drafts\` review and \`GET /api/iphone/ledger\` support confirmation and one-way sync into IndexedDB. Existing Settings screen offers textual reviews, no slip image.
- Supabase project \`money-tracker\` (Singapore): \`public.money_tracker_iphone_drafts\` exists with RLS, anon/authenticated SELECT disabled; **zero private storage buckets**, and no recorded drafts at audit.
- Vercel: \`money-tracker-api\` Production deployment READY on iPhone feature branch; existing website \`money-tracker\` Production deployment uses an older main SHA than the iPhone feature source. Review UI must be deployed deliberately, not assumed live.
- Two distinct bearer tokens currently authenticate upload vs review. Review token lives in localStorage in a single-owner MVP; do not expose Supabase service role in client or Shortcuts.
- Baseline SQL: \`supabase/migrations/20261010114100_iphone_shortcut_drafts.sql\`. Make **additive** changes, never overwrite existing transactions.

## 2. Product behavior and retention contract

1. User opens receipt screenshot from iPhone Photos/LINE/K PLUS and invokes Share Sheet **Save to Money Tracker** (or manually selects a photo).
2. Shortcut **resizes/converts** to JPEG if needed, sends multipart \`image\` to \`POST /api/iphone/upload\`, with **upload bearer token**. Limit 3 MiB.
3. Backend authorizes and validates file extension, MIME, magic bytes, length and image dimensions. It hashes the bytes, runs OCR, extracts amount/date/direction conservatively, and prevents duplicates.
4. New draft and **private object** are linked by generated IDs. Image is stored in Storage only for a new accepted image draft, not for text-only Photos requests. Upload response is \`202 pending\` with \`image.expiresAt\`, never a public URL.
5. Reviewer goes to **Review Inbox** on Money Tracker and sees a protected original image alongside editable OCR suggestions. Confirmation is an explicit action; account-to-account transfer may be discarded.
6. Both confirmed and still-pending records may **retain their associated image only until \`uploaded_at + 168 hours\`**. An expiry barrier prevents retrieval after that instant. Financial record / confirmed transaction survives expiration; it is not deleted with its image.
7. On discard, delete the associated image promptly (privacy-first) and retain minimal dedupe metadata. Image expiry always applies even when a review is still pending.
8. An hourly scheduler removes expired physical objects via **Supabase Storage API**. Failed deletions retry with traceable non-sensitive status. In the unusual case of scheduler downtime, read access is *already* denied at expiry and a catch-up cleanup must purge backlog as soon as service recovers. **Do not promise exact-to-the-second physical deletion.**
9. Existing text-only automation remains available: OCR on-device → \`/api/iphone/photos\` → structured draft, **no image**.

### Recommended image retention UX text

- Available: \`รูปสลิปจะลบอัตโนมัติภายใน 7 วันหลังอัปโหลด\`, plus localized expiry time.
- Expired: \`ภาพสลิปหมดอายุแล้ว ข้อมูลรายการยังอยู่และตรวจสอบ/ยืนยันต่อได้\`.
- No image (Photos OCR-only): \`รายการนี้ส่งเฉพาะข้อความ ไม่ได้แนบภาพ\`.
- Error/retry: \`ไม่สามารถโหลดภาพได้ กรุณาลองใหม่\` (do not show private bucket path or secrets).

## 3. New Storage and DB model

**Bucket:** \`money-tracker-slip-temp\`; \`public=false\`; standard object storage; allowed MIME \`image/jpeg,image/png,image/webp\`; file size limit **3 MiB**. Create through **Storage API / Supabase Dashboard**, never direct writes to \`storage.buckets\` or \`storage.objects\`. Keep the bucket opaque and avoid any broadly permissive RLS policies. Backend only uses service role after own bearer authorization.

**Object path:** server-generated opaque \`drafts/<owner-hash-prefix>/<draft-uuid>.<validated-extension>\`; never trust client-supplied paths or names. \`upsert=false\`, disallow image metadata overwrite.

**Additive DB migration** on \`public.money_tracker_iphone_drafts\`:
- \`image_status\` TEXT DEFAULT \`none\` CHECK in (\`none\`, \`uploading\`, \`available\`, \`upload_failed\`, \`deleting\`, \`deleted\`, \`delete_failed\`).
- \`image_bucket\` TEXT nullable; \`image_path\` TEXT nullable, unique when not null.
- \`image_mime\` TEXT nullable; \`image_size_bytes\` INTEGER nullable CHECK (0 < size <= 3145728).
- \`image_uploaded_at\` TIMESTAMPTZ nullable; \`image_expires_at\` TIMESTAMPTZ nullable; \`image_deleted_at\` TIMESTAMPTZ nullable.
- \`image_delete_attempts\` INT DEFAULT 0; \`image_last_error_code\` TEXT nullable (sanitized categorical codes only).
- Index \`(image_expires_at, image_status)\` where \`image_path IS NOT NULL\` and image not deleted. Invariant \`image_expires_at = image_uploaded_at + interval '7 days'\`, set by server/DB and test.
- Existing rows stay \`image_status=none\` and remain readable. Text-only rows remain unchanged. No raw OCR text, account numbers, or image base64 in DB.

**Data-model caution:** Existing owner hash derives from \`IPHONE_REVIEW_TOKEN\`. Rotating review token today changes the owner hash and can orphan access to old drafts. Put stable owner identity + token-rotation migration on the security backlog or implement within this feature before rotation; never silently rewrite existing owner keys.

## 4. Endpoints and contracts

| Route | Auth | Contract |
|---|---|---|
| \`POST /api/iphone/upload\` | Upload token | \`multipart/form-data\` with \`image\`; check 3 MiB; OCR; unique staged row; private image save; \`202 {status:'pending',draftId,image:{available:true,expiresAt}}\` / \`200 duplicate\` / safe 4xx-5xx errors. |
| \`POST /api/iphone/photos\` | Upload token | Keep \`application/json {text}\`, preserve text-only and safety filter; no image. |
| \`GET /api/iphone/drafts\` | Review token + allowlisted app Origin | Keep pending list, add \`image:{status,available,expiresAt}\`; **never return storage paths or service role credentials**. |
| \`GET /api/iphone/image?id=<UUID>\` | Review token + exact app Origin | Verify same owner and \`now < image_expires_at\` *before* reading blob; proxy binary with correct safe \`Content-Type\`, \`Cache-Control: private,no-store\`, \`X-Content-Type-Options:nosniff\`. Return 404 (no image), 410 (expired), 401/403 (auth), 503 (upstream); never expose public URL. |
| \`POST /api/iphone/drafts\` | Review token + allowlisted app Origin | Preserve confirm/discard and validation; on discard enqueue immediate private image cleanup; never block financial confirmation solely because a photo has expired. |
| \`GET /api/iphone/ledger\` | Review token + allowlisted app Origin | Preserve **transaction-only** response and current one-way IndexedDB semantics, independent of blob lifecycle. |
| \`POST /api/iphone/cleanup\` | Separate \`SLIP_CLEANUP_SECRET\`, not upload/review tokens | Server-only idempotent, bounded batch processor; claim expired/failed objects, call Storage API delete, then mark DB \`deleted\`. Return aggregate safe metrics only. |

**Client review preview:** authenticated \`fetch\` with review bearer → \`Blob\` → \`URL.createObjectURL()\` for <img>; revoke URL after drawer unmount/change; never put bearer tokens in query strings, page URL, browser logs, image CDN, public signed URL, telemetry, or source control. Fetch selected draft only; don't bulk-download all pictures.

**Upload consistency / idempotency design:**
- Validate and hash file, run conservative OCR, insert deduped draft with \`uploading\` status, then upload exactly one object and atomically patch metadata to \`available\`.
- On duplicate, return existing status without reupload; allow safe reattempt of \`upload_failed\` for same digest, do not create a second transaction.
- On object-write failure, return failure and record safe retry state. On DB-update failure after successful blob write, compensate by deleting blob; a sweeper must reconcile orphan objects and \`uploading\` timeouts.
- **Avoid double bookkeeping** on simultaneous POST of same image or identical bank fingerprint. Keep uniqueness constraints and tests.
- Never log raw OCR, image bytes, financial note text, keys or account numbers.

## 5. Deletion architecture (hourly)

Use **Supabase Cron (pg_cron + pg_net)** to make an hourly HTTPS call to the protected Vercel cleanup route. Keep \`SLIP_CLEANUP_SECRET\` in **Supabase Vault** and separately in Vercel Production secrets; do not inline in SQL migrations or repo. Trigger with \`Authorization: Bearer <secret>\` and a finite timeout. Vercel Hobby Cron by itself only supports **daily** cadence; it is not the chosen hourly trigger.

- A claim operation locks/batches expired rows (\`FOR UPDATE SKIP LOCKED\`, or equivalent leased states) so overlapping runs don't fight.
- Delete files by the **Storage API**, not raw SQL on Storage metadata. Only after Storage success / verified absence, mark \`deleted\`, set deletion timestamp, clear \`image_path\` and any exposable access.
- Increment attempt count + store sanitized error category on recoverable failures; retry with backoff. Alert on any \`delete_failed\` older than 1 hour and any object physically remaining > 8 days.
- Perform hourly orphan reconciliation: objects with no matching draft, draft rows stuck \`uploading\` after timeout, expired \`available\` rows, already-absent storage objects.
- For strictly enforced UX retention, image API denies at **exact expiry** regardless of cron drift; observe cleanup lag and document that physical purge is asynchronous.
- No cron job may delete structured transactions or IndexedDB records. Do not rotate security tokens in deployment without a migration strategy.

Vendor reference: Supabase current-object lifecycle rules cannot be assumed to expire these objects automatically; explicit deletion worker is required. Storage deletes must use Storage API.

## 6. Review Inbox — interaction and UI states

**Information architecture:** retain Settings > iPhone Shortcut entry and add a discoverable **Review Inbox** (mobile-first), ideally shortcut from home showing pending count. Existing \`src/IPhoneShortcutSettings.tsx\` can host first-stage Review to avoid new router, then evolve to a full-screen/drawer experience.

- Mobile 375 px: single-column image preview (tap to zoom) → OCR fields → actions fixed/visible without overlapping safe area. Desktop: split layout image on left, editable structured fields on right.
- Fields: direction (explicit income/expense), amount THB, calendar date (Thai Buddhist-year handling), category, method, note; validation and own-account transfer guidance.
- Image states: \`available\`, \`loading\`, \`expired\`, \`no image\` (OCR-text-only), \`upload failed\`, \`temporarily unavailable\`, \`discarded\`. Provide accessible alt text, keyboard controls, focus restoration, zoom, status reader labels, loading & retry.
- Viewable photo isn't authoritative: user explicitly verifies parsed values. Confirmation updates ledger once; duplicate handled; original OCR draft remains separate.
- Add plain-language privacy disclosure: **receipt images are sent to private cloud storage and automatically removed after 7 days**; transaction data stays. Existing "everything local, never synced" copy must be adjusted without misleading users. Browser ledger remains one-way IndexedDB; back up JSON.
- On image expiration while user is reviewing, show expired placeholder, keep form values and permit review/confirmation.

## 7. File-level implementation tasks

| ID | Priority | File / system | Change | Acceptance |
|---|---|---|---|---|
| T01 | P0 | New \`supabase/migrations/*_slip_image_retention.sql\` | Add metadata columns/constraints/index, preserving existing data/RLS | Old rows remain valid, migrations reversible, anon cannot read |
| T02 | P0 | Supabase Storage bucket | Private \`money-tracker-slip-temp\`, MIME and 3 MiB limits | Public retrieval forbidden; service-only upload |
| T03 | P0 | \`server/iphone/bridge.ts\` and new \`server/iphone/imageStorage.ts\` | Stable identity boundary, metadata state, safe storage REST ops | No leaked keys, input paths, orphan leaks |
| T04 | P0 | \`api/iphone/upload.ts\` | Image persist + rollback/retry/idempotency while preserving OCR | 202 image available, duplicate 200, failed upload recoverable |
| T05 | P0 | New \`api/iphone/image.ts\` and \`api/iphone/drafts.ts\` | Protected image proxy, metadata only in JSON | 401/403/404/410 gates, no public URLs |
| T06 | P0 | New cleanup route + Supabase Cron/Vault | Hourly purge and safe retries/orphan reconciliation | 7-day access block, physical purge monitored |
| T07 | P1 | \`src/lib/iphoneSync.ts\`, \`src/IPhoneShortcutSettings.tsx\`, CSS | Review image, zoom, expiry, robust states | Responsive/mobile accessible, no token in DOM/logs |
| T08 | P1 | \`src/App.tsx\`, documentation | Review entry, privacy copy, shortcut guidance | Accurate disclosure + existing UX unaffected |
| T09 | P0 | Vitest integration/unit tests, browser audit | Valid/invalid image, duplicate, failure, expiry, cleanup and RLS | All specified gates PASS |
| T10 | P0 | Vercel API Preview + web Preview, manual iPhone QA | Secure deploy + real device Share Sheet + rollback | Approved launch only after E2E evidence |

## 8. Explicit QA matrix and launch gates

**API/unit:** authorized upload 202; unauthenticated 401; wrong origin 403 for review; corrupt magic/MIME 415; 3 MiB size 413; duplicate bytes 200; duplicate bank fingerprint never creates another expense; wrong bank balance ignored; unsupported HEIC convert client-side; OCR misses yield editable nulls, not guessed data.

**Storage/security:** bucket private (anon GET denied); leaked object path alone cannot reveal photo; reviewed image requires same owner and token; photos OCR-text-only never writes objects; direct browser signed/public image URL prohibited; \`Cache-Control:no-store\`, no sensitive logs.

**Time:** \`now == expiresAt\` returns 410; image before expiry 200; cron deletes overdue blobs; re-run cron idempotent; Storage 5xx retry; failure between DB insert/storage upload and between Storage delete/DB update recovered; image expires while drawer open; records survive expiry.

**UX / finance:** compare source image and parsed amount/date/direction; own-account transfers not booked as expenses; confirmation required; confirm/discard once; no duplicate imports; view pending after failed image load; accessible 320/375/390/430/768/1280 px, iPhone Safari and Shortcut with real slip sanitized for QA.

**Launch sequence:** staging branch → unit + integration + mobile browser tests → provision isolated bucket / Cron secrets → API Preview smoke → web Preview + iPhone QA → security review + costs/quotas → owner approve → backend production deploy → web production deploy → monitor cleanup, rollback if needed. Preserve original \`money-tracker\` deployment protection and all existing financial rows.

**Definition of Done:** image uploaded to private bucket, shown only to authorized reviewer, review/ledger work, image retrieval blocked at precisely 168 h, automated purge/retries operational, financial rows retained, zero public image exposure, QA evidence collected, production released with rollback documented.

## 9. Current blockers / decisions

- Storage bucket and new DB columns do not yet exist.
- Cleanup job / Vault secret not configured; don't schedule until delete implementation is tested.
- Frontend Production has not been proven to contain latest iPhone Review source.
- Existing upload/review tokens are **sensitive**; never request/paste values into a conversation, PR, screenshot, or repository.
- Hourly Supabase Cron depends on the project remaining active and the job being healthy. Add a missed-run/backlog alert; do not misrepresent asynchronous physical deletion as mathematically guaranteed at 168 h.
- When enabling cloud image uploads, privacy messaging/consent must be revised before real-person data is sent.
- No production storage, schema, cron or app behavior should be mutated just to author this plan.

## 10. Vendor documentation

- Supabase Storage access: https://supabase.com/docs/guides/storage/security/access-control
- Supabase delete objects: https://supabase.com/docs/guides/storage/management/delete-objects
- Supabase scheduling: https://supabase.com/docs/guides/functions/schedule-functions
- Supabase current version lifecycle limitations: https://supabase.com/docs/reference/javascript/file-buckets-updatebucketlifecycle
- Vercel Hobby cron restrictions: https://vercel.com/docs/cron-jobs/manage-cron-jobs
