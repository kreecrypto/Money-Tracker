# iOS 26 Shortcut → Money Tracker (Direct, no LINE OA)

## Implementation / status

**The API + app code is ready for automated testing, NOT live until you configure a dedicated Supabase project, upload/review tokens, and public HTTPS bridge.** No existing financial data is migrated or altered during deployment.

### End-to-end user journey

1. Open a bank LINE OA chat on iPhone 26 (e.g., KBank Live).
2. Take a screenshot. Tap the thumbnail → Share → **Save to Money Tracker** Shortcut. The Shortcut receives the selected image, converts it to JPEG, resizes it, and uploads via HTTPS POST.
3. Server checks the dedicated 256-bit **UPLOAD TOKEN**, validates JPEG/PNG/WebP signature and up to 3 MiB image size. Reject untrusted files. OCR recognizes Thai/English.
4. A conservative parser extracts the transaction amount next to **จำนวนเงิน**, excluding **ยอดเงินคงเหลือ** (bank balance). Any uncertainty stays blank; it is never guessed.
5. Server stores only a **pending OCR draft** with hashed image and transaction fingerprint in a private Supabase table. **No screenshot or raw OCR text is saved.** Duplicate screenshots/transaction fingerprints cannot produce another draft.
6. Open Money Tracker → Settings → iPhone Shortcut → Review pending entries. Check or correct direction (income/expense), amount, date, category and method. A transfer between your own accounts should be **discarded**, not classified as an expense.
7. Press **ยืนยันบันทึก**. The secure API atomically changes the draft to **confirmed**. The browser uses its separate **REVIEW TOKEN** to sync confirmed records to existing local IndexedDB, where they immediately appear on the dashboard, transactions and reports.
8. The app also retries sync when brought into the foreground; an explicit **ตรวจรายการใหม่จาก iPhone** action is provided.

### Design and security

**Single-owner MVP:** Two distinct 64-character hex tokens, each generated as 32 cryptographically secure random bytes. One token is for Shortcuts uploads, one for viewing/reviewing/syncing financial records in the browser. The review token is entered in Money Tracker Settings and stays in that browser's localStorage; the upload token belongs ONLY in your personal Shortcut. Never share either token, show it in screenshots, or commit it to GitHub. Use a separate user-account/login design for a public multi-user release.

API routes:
- POST \`/api/iphone/upload\`: \`Authorization: Bearer <IPHONE_UPLOAD_TOKEN>\`, multipart Form field **image**, <= 3 MiB JPEG/PNG/WebP. Returns \`{"status":"pending","draftId":"...","reviewRequired":true}\` (202) or duplicate (200).
- GET \`/api/iphone/drafts\`: \`Authorization: Bearer <IPHONE_REVIEW_TOKEN>\`, origin restricted to app, returns pending drafts only.
- POST \`/api/iphone/drafts\`: same review token and app origin; JSON body includes id, decision=confirm/discard and validated transaction fields if confirmed; atomic pending→confirmed/discarded.
- GET \`/api/iphone/ledger\`: same review token and app origin, returns confirmed entries for IndexedDB sync.
- OPTIONS only for configured app origin.

No application/Vercel services receive the LINE OA chat history. The user manually shares the selected screenshot. Unsupported/invalid media never reaches OCR. Nothing is auto-booked before review.

## Setup needed (owner action)

### 1. Dedicated database

Create or authorize a **new Money Tracker Supabase project**, preferably region Singapore, with an explicitly confirmed billing organization. Do not reuse unrelated project database or any third-party financial information without permission. Apply **\`supabase/migrations/20261010114100_iphone_shortcut_drafts.sql\`** using the Supabase SQL editor or a reviewed migration. Validate RLS: anon/authenticated users cannot read/write the table, service_role only.

### 2. Secure public API

The current Vercel project uses Vercel Authentication for project deployments. iPhone Shortcuts requires a publicly reachable HTTPS **API hostname**, independent of its existing SSO protection. Options:
- A dedicated public Vercel bridge project deploying these functions, or
- A Vercel custom domain with suitable route protection while preserving existing dashboard access control.

**Do not disable SSO for the whole existing project without explicit authorization.** The individual upload/review routes enforce Bearer auth regardless of their host's availability.

Configure these **server-only** Vercel secrets, never with \`VITE_\` prefix:
- \`IPHONE_UPLOAD_TOKEN\`: independent 64-character uppercase hex value (generate: \`openssl rand -hex 32\`)
- \`IPHONE_REVIEW_TOKEN\`: another different 64-character uppercase hex value
- \`IPHONE_ALLOWED_APP_ORIGIN\`: exact Money Tracker web app origin, e.g. \`https://money-tracker-beta-teal.vercel.app\`
- \`SUPABASE_URL\`: URL of the approved new Money Tracker project
- \`SUPABASE_SERVICE_ROLE_KEY\`: secret DB service role key, on backend ONLY

Configure **public** client-side Vite env in the Money Tracker frontend:
- \`VITE_IPHONE_BRIDGE_URL\`: \`https://<public-bridge-host>\` (public URL, not a secret)

Redeploy after configuring environment variables.

### 3. Build Shortcut on iOS 26

1. Open **Shortcuts (คำสั่งลัด)** → + → New Shortcut; rename to **Save to Money Tracker**.
2. Tap **Details (i)** → enable **Show in Share Sheet**; set accepted input to **Images**.
3. Add **Resize Image**: input **Shortcut Input**, width approx **1800–2000 pixels** (preserving aspect ratio). Keep bank figures legible.
4. Add **Convert Image**: JPEG, medium/high quality (e.g. 75–85%). Result should be **under 3 MB**; if it is bigger, resize further.
5. Add **URL** action with the public bridge URL followed by \`/api/iphone/upload\`.
6. Add **Get Contents of URL (รับเนื้อหาของ URL)**:
   - Method: **POST**
   - Headers: **Authorization** = \`Bearer \` + your private \`IPHONE_UPLOAD_TOKEN\` (single space after Bearer)
   - Request Body: **Form**, add key **image** with File value from **Convert Image**. Do not send base64 JSON.
7. Add **Get Dictionary Value** to retrieve response key \`status\`, then **Show Result**:
   - \`pending\` → “ส่งแล้ว — เปิด Money Tracker เพื่อยืนยัน”
   - \`duplicate\` → “รูปนี้เคยส่งแล้ว”
   - otherwise show error. **Do not display or log the token.**
8. On iPhone LINE: open a notification → screenshot → tap thumbnail → **Share** → **Save to Money Tracker**. Then open Money Tracker Settings to review.

Note: In some versions of Shortcuts the input content may not be available from LINE's message Share Sheet. Always using the screenshot's Share Sheet is the reliable workaround.

### 4. Pair web review

1. Open Money Tracker on the iPhone (or another trusted browser).
2. Go to **ตั้งค่า → iPhone Shortcut → เงินวันนี้**.
3. Enter **IPHONE_REVIEW_TOKEN**; connect and refresh.
4. Confirm or discard the draft, then check Home and Reports.
5. Always keep a JSON backup of local IndexedDB. The client sync is currently **one-way** (server → local); edits in the browser do not sync back.

## QA / go-live gate

- Unit tests: token authorization, MIME signature, bank balance exclusion, pending staging and deliberate confirmation.
- Automated Browser Audit: 6 viewports, zero accessibility issues / horizontal overflow, existing save/restore/OCR unchanged.
- On the real iPhone: Screenshot → Shortcut POST with small JPEG → server 202 → app pending review → manual confirm → local list + totals update.
- Negative tests: forged token 401; invalid media 415; oversize 413; duplicate returns existing/duplicate; no RLS anon read; own-account bank transfers not booked.
- iPhone Safari and iOS Shortcuts real-device test is **pending until infrastructure configured**.
- Image processing may take time when server OCR downloads Thai/English language models for the first time.

## References

- Apple: https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios
- Vercel: https://vercel.com/docs/functions/limitations
- Vercel: https://vercel.com/docs/functions/runtimes/node-js
