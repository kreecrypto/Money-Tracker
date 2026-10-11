# iOS 26 — Shortcut sends only an image; Money Tracker owns OCR + private storage

## Goal and compatibility
**Shortcuts does not run OCR and does not send text.** It sends a single JPEG/PNG/WebP image in an authenticated multipart HTTP POST. Money Tracker API executes Thai+English OCR (Tesseract), stores raw OCR text and extracted fields in a server-only database row, and stores the original uploaded bytes in a private Supabase Storage bucket. Users explicitly confirm or discard the transaction in Review Inbox.

> Apple iOS 26 cannot read arbitrary bank push notification contents using a stock Shortcuts Automation trigger. Use Share Sheet for explicit individual images, or a time/app-triggered bounded photo selection. Do not claim push interception.

## Contract — request
- POST `https://<APPROVED_QA_API_HOST>/api/iphone/upload`
- Header `Authorization: Bearer <IPHONE_UPLOAD_TOKEN>`. Use **upload** token only, never review, Supabase service role or cleanup token.
- Request Body: **Form** (multipart). Key `image`, Value type **File**, Value **Converted Image**. Let Shortcuts set multipart Content-Type/boundary.
- Image MIME `image/jpeg`, `image/png` or `image/webp`; **max 3 MiB** after conversion. Original HEIC must be converted to JPEG on device.
- Successful first upload: HTTP **202** `{status:"pending",draftId:"...",reviewRequired:true,image:{available:true,expiresAt:"..."}}`
- Duplicate bytes: HTTP **200** `{status:"duplicate",reviewRequired:false}`.
- Invalid bearer: HTTP **401**. Bad file MIME: HTTP **415**. Oversize: HTTP **413**. OCR/storage unavailable: HTTP **503**. Never interpret failed requests as successful sync.
- Response intentionally **does not include image bytes, raw OCR text, bank balances, account numbers or tokens.**

## Create a native Shortcut on an iOS 26 iPhone (no unsigned import)
1. Open **Shortcuts → +** and name it `Money Tracker — Send Slip`.
2. Open Shortcut details → **Show in Share Sheet** → Receive **Images** only.
3. Add `Repeat with Each` using **Shortcut Input**. Inside:
   - `Resize Image` (optional, preserve aspect ratio, long edge around 2000–2400px).
   - `Convert Image` to **JPEG**. Keep output as `Converted Image`.
   - Check converted file size if available; skip and notify if larger than 3 MiB.
   - Add `URL` with the approved QA API host and `/api/iphone/upload` suffix.
   - Add `Get Contents of URL`, `Method = POST`, `Headers: Authorization = Bearer <UPLOAD_TOKEN>`, `Request Body = Form`, `image = [File] Converted Image`.
   - Use `Get Dictionary Value` for `status` and show a neutral success/duplicate/failure result **only if the HTTP request succeeded**.
4. Test with a synthetic JPEG in Photos → Share → `Money Tracker — Send Slip`. No OCR action belongs in this Shortcut.
5. Keep the Shortcut private: no tokens in shared iCloud links or screenshots. Rotate upload token if the shortcut is exported or device access compromised.

## Optional automatic execution
Create a **second** Shortcut `Money Tracker — Scan Slip Album`:
- `Find Photos` with **Album = Money Tracker Slips**, sorted newest, limit 5, filter to recent interval if available.
- `Repeat with Each` → `Run Shortcut` `Money Tracker — Send Slip` with `Repeat Item` input. (A shared Shortcut must accept images explicitly.)
- **Personal Automation** in iPhone Shortcuts → Time of Day, or App Is Closed, → run the album scan shortcut automatically where iOS permissions allow.
- Only scan a **dedicated, deliberately curated album**; do not transmit the whole camera roll. App Is Closed is not a reliable receipt-saved event, so a scheduled scan can be a fallback. If the bank app does not save a picture, there is nothing to upload. Server image-byte digest dedupes repeated uploads.
- Do not silently upload arbitrary Photos, messages, screenshots or OTP images.

## Money Tracker backend responsibilities
- `POST /api/iphone/upload`: authenticate upload bearer, enforce content type and byte limit, OCR server side, store structured data and OCR text in draft row (`ocr_text`), store image in private `money-tracker-slip-temp` Storage path.
- `GET /api/iphone/drafts`: requires allowed web Origin and separate **Review Token**; includes `ocrText` only for authorized pending review. Browser renders raw text in a collapsed `details` section. UI must never trust OCR amounts or direction without manual verification.
- `GET /api/iphone/image`: separate authenticated image proxy, no public bucket URLs/signed links. Image access expires at exactly **168 hours**. Physical deletion requires working cleanup, which remains **disabled** until the E2E gate passes.
- Structured ledger and OCR text persist in private draft database records beyond image expiry unless a separate approved retention/deletion policy is implemented. OCR text can contain names, bank balances and account numbers: restrict reviewer access and never log or expose it through the upload response.
- The older `/api/iphone/photos` (text-only) route remains available for legacy workflows. This image-only Shortcut does **not** call it.

## Release gates — not live yet
1. Migration `20261011082000_iphone_image_ocr_evidence.sql` must be applied to an **isolated QA database** first. No production migration or secrets reuse without approval.
2. API Preview has separate tokens but **no QA Supabase connection** yet. Keep Vercel Deployment Protection enabled. Shortcuts cannot necessarily call a protected API URL without an approved authentication method.
3. Verify negative live smoke, synthetic upload → pending → restricted text+image → confirm/discard → exact-once ledger, expiration 410, physical Storage deletion, RLS restrictions and 7-day behavior.
4. QA real iPhone iOS 26 with test photo, HEIC conversion, failed network retry, background permissions.
5. Only after all stages pass consider production promotion and separately enable cleanup cron (which is **not** enabled by this change).
