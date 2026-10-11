# Money Tracker — iOS 27 K PLUS Photos → OCR text only

This flow reflects the demonstrated iPhone Shortcut: **Find Photos where Album is K PLUS → Extract Text from Image**. No bank notification interception, image upload, or server-side OCR is used in this flow. K PLUS must actually save a slip into Photos, and the custom K PLUS album must already contain it.

## Shortcut — Scan K PLUS Slips

1. Create a Shortcut named Money Tracker — Scan K PLUS.
2. **Find Photos:** Album is K PLUS, Sort by Date Taken, Order Latest First, Limit 1 for first test, then 5. Prefer a recent created-date cutoff if available.
3. **Repeat with Each** using the Photos result. INSIDE the repeat:
   - **Extract Text from Image**, input **Repeat Item**, not the entire Photos result; refer to result as SlipText.
   - **If** SlipText contains **โอนเงินสำเร็จ**, continue; otherwise skip sending. Later add further explicit KBank notification patterns only when validated.
   - **Get Contents of URL** → https://money-tracker-api-blush.vercel.app/api/iphone/photos → POST; header Authorization = Bearer <production IPHONE_UPLOAD_TOKEN>; Content-Type = application/json; Request Body JSON with key **text** (type Text), value = the current image's extracted SlipText.
   - Inspect JSON response status: pending, duplicate, skipped. NOT_CONFIGURED, 401 and 503 are errors, not success.
4. End Repeat. Confirm the resulting draft's transaction amount, direction, and date in the Money Tracker review UI; the bank may show sender/recipient info but this doesn't automatically establish direction from the user's perspective.

## Optional Automation

Shortcuts → Automation → App → K PLUS → Is Closed → Run the scan Shortcut (where allowed). This runs when the app closes, **not** when Photos saves a new slip. Prefer manual first, then schedule a fallback as permitted. A custom Photos album normally needs slips intentionally added to it; never claim an automatic bank push body read.

## Safety

- OCR is on the iPhone. Only text is sent to the server, one receipt at a time. Raw text travels to the API but is not persisted by this endpoint; server persists parsed draft fields.
- Token must be 64 hex characters and different from review token. Do not copy secret token into chats, screenshots or publicly shared Shortcuts.
- Avoid sending unrelated Photos or OTPs. One album plus an explicit local text condition is a conservative client-side guard, not proof of image provenance.
- The server currently also recognizes non-KBank brands, so stricter bank-only enforcement is a separate change requiring verification of OCR formats.
- The OCR example in the user's video uses **จำนวน:** with the amount on the next line. Both the bank-slip classifier and amount parser now recognize this bounded label, while excluding fee lines.
