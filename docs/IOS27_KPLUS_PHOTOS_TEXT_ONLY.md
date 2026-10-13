# Money Tracker — iOS 27 K PLUS Photos → OCR text only

This flow reflects the demonstrated iPhone Shortcut: **Find Photos where Album is K PLUS → Extract Text from Image**. No bank notification interception, image upload, or server-side OCR is used in this flow. K PLUS must actually save a slip into Photos, and the custom K PLUS album must already contain it.

## Shortcut — Scan K PLUS Slips

1. Create a Shortcut named Money Tracker — Scan K PLUS.
2. **Find Photos:** Album is K PLUS, Sort by Date Taken, Order Latest First, Limit 1 for first test, then 5. Prefer a recent created-date cutoff if available.
3. **Repeat with Each** using the Photos result. INSIDE the repeat:
   - **Extract Text from Image**, input **Repeat Item**, not the entire Photos result; refer to result as SlipText.
   - **If** SlipText contains **K PLUS** or **กสิกร/ธ.กสิกรไทย** or **KBank**, AND contains a transfer/success label such as **โอนเงินสำเร็จ**, AND contains the transaction amount label **จำนวนเงิน** or **จำนวน:**, continue; otherwise skip sending. The three checks must all pass before the network action.
   - **Get Contents of URL** → https://money-tracker-api-blush.vercel.app/api/iphone/photos → POST; header Authorization = Bearer <production IPHONE_UPLOAD_TOKEN>; Content-Type = application/json; Request Body JSON with key **text** (type Text), value = the current image's extracted SlipText.
   - Inspect JSON response status: `saved` (201), `pending` (202), `duplicate` (200), `skipped` (200, e.g. `unsupported_bank`). HTTP 401/503 are errors, never success. For 503 inspect the safe `stage` / `code` fields; never share tokens.
4. End Repeat. For complete K PLUS transactions with explicit direction, date, time, amount and recipient, the API saves immediately to Supabase; no Review tap is required. Ambiguous transfers and missing fields remain in the Review queue.

## Connect Money Tracker App once

1. Open Money Tracker → Settings → iPhone Photos → enter your private **IPHONE_REVIEW_TOKEN** (not the upload token) and tap Connect. Never publish this token in a Shortcut or repository.
2. The API's `VITE_IPHONE_BRIDGE_URL` and `IPHONE_ALLOWED_APP_ORIGIN` must match your production app origin. The iPhone settings card indicates an unconfigured bridge.
3. After the first connection, confirmed Shortcut items import automatically when Money Tracker opens, resumes or remains open (approximately every 60 seconds). Browser must have internet. Local entries remain local; this is **one-way** sync, not full two-way Cloud Sync.
4. If OCR omits a date, time, recipient or direction, the result stays pending and requires review; never fill missing fields by guessing.

## Optional Automation

Shortcuts → Automation → App → K PLUS → Is Closed → Run the scan Shortcut (where allowed). This runs when the app closes, **not** when Photos saves a new slip. Prefer manual first, then schedule a fallback as permitted. A custom Photos album normally needs slips intentionally added to it; never claim an automatic bank push body read.

## Safety

- OCR is on the iPhone. Only text is sent to the server, one receipt at a time. Raw text travels to the API but is not persisted by this endpoint; server persists parsed draft fields.
- Token must be 64 hex characters and different from review token. Do not copy secret token into chats, screenshots or publicly shared Shortcuts.
- Avoid sending unrelated Photos or OTPs. One album plus an explicit local text condition is a conservative client-side guard, not proof of image provenance.
- The text-only endpoint now **rejects non-KBank OCR**, including other banks with valid transfer/amount labels (`skipped: unsupported_bank`).
- The OCR example in the user's video uses **จำนวน:** with the amount on the next line. Both the bank-slip classifier and amount parser now recognize this bounded label, while excluding fee lines.

## Release validation (2026-10-12)

- Save a **new real** K PLUS slip into the selected Photos album (a private test fixture can be used for server unit tests, but not as proof of real-device automation).
- Run the Shortcut while the iPhone is unlocked. Verify `201 saved` for a complete explicit outgoing slip, otherwise `202 pending` with a new Review draft.
- After one-time Review Token pairing, verify exactly one transaction appears on the Money Tracker Dashboard without manually adding or uploading the slip. For pending items, complete manual review.
- Run the Shortcut again and expect `200 duplicate` rather than a second entry.
- If the bank header is not present in on-device OCR, do not send ambiguous text; correct the Photos crop or use manual Review rather than relaxing the server's KBank-only gate.
- iOS Photos is not triggered by every image save and K PLUS may not save a slip automatically; App Is Closed is a best-effort trigger only.
