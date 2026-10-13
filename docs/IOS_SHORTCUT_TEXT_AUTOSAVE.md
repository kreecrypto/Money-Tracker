# iPhone Shortcut → Text → API → Money Tracker Auto Save

## Result

**No manual upload to Money Tracker.** Shortcut performs on-device `Extract Text from Image` (or receives a bank notification text), then POSTs a small JSON payload to the API. The API validates K PLUS/KBank-only transaction text, deduplicates by hashed content and bank reference, and writes confirmed transactions to Supabase. It never stores images or raw OCR text.

When Money Tracker PWA opens or returns to the foreground, it syncs confirmed rows into IndexedDB automatically. The API commit happens **even if the app is closed**, but a closed PWA cannot update its local IndexedDB until it runs.

## Shortcut actions

1. **Select Photos** (or accept **Images** from Share Sheet / existing Photo Automation)
2. **Extract Text from Image**; keep the entire extracted text as the magic variable `Extracted Text`
3. **URL** = `https://money-tracker-api-blush.vercel.app/api/iphone/photos`
4. **Get Contents of URL**:
   - Method: **POST**
   - Headers: `Authorization`: `Bearer <IPHONE_UPLOAD_TOKEN>` (64-character production upload token)
   - Request Body: **JSON**
   - Key `text` (Text) = magic variable `Extracted Text`
   - Key `direction` (Text) = `expense` **only for a Shortcut dedicated to your OWN outgoing K PLUS receipts**. Omit direction when using bank notifications that already say money in/out. A contradictory explicit direction is rejected.
5. **Show Result** while testing. Once stable, make it show only failures. Do not send photos to `/api/iphone/upload`.

### Text received directly
If the source is a genuine bank notification containing transaction date, amount, and direction, skip `Select Photos` and `Extract Text from Image`; put the notification text in JSON `text`. Do not assume iOS Automation can read arbitrary private app notifications; actual trigger and readable fields depend on the iOS version and app privacy settings.

## One-time Money Tracker pairing
In Money Tracker → **Settings → iPhone Shortcut**, enter the 64-character **IPHONE_REVIEW_TOKEN** from the Vercel project once. This is NOT the Upload Token. Never put the review token in Shortcuts and never embed it in the app build. The token stays in local browser storage; use your personal device only. On initial pairing or subsequent app opens/resumes, the app reads only the confirmed ledger and merges stable `iphone-<uuid>` IDs into IndexedDB without creating duplicates.

## API responses

- `201 {"status":"saved","transactionId":"iphone-…","reviewRequired":false}`: permanently confirmed in Supabase; the app syncs next time it is foregrounded
- `200 {"status":"duplicate","reviewRequired":false}`: already received, no extra transaction
- `202 {"status":"pending","missingFields":[…]}`: insufficient amount, date, or direction — **not included in financial totals**
- `200 {"status":"skipped","reason":"unsupported_bank" | "not_receipt" | …}`: not recognized as a K PLUS transaction
- `422 {"status":"skipped","reason":"DIRECTION_CONFLICT"}`: Shortcut hint contradicts explicit text

## Safety and privacy

- The API only auto-saves when direction, transaction date and paid amount are established. Incomplete or ambiguous transactions go to an exception queue; no guesswork.
- Time and recipient are recorded when recognized; missing optional fields remain empty.
- The original image stays in iPhone Photos only. If you use Shortcuts to delete it, that is a separate user action; Money Tracker does not delete your Photos.
- Dedup uses a hash of normalized text and, when available, an additional hash of the transaction reference.
- Both existing image-upload UX and the existing manual review endpoints remain available, but the happy-path Text API no longer requires them.
- Separate Safari and Home Screen PWA local storage may show different histories; always open the same installed Money Tracker app for syncing.
- Configured frontend origin must match `IPHONE_ALLOWED_APP_ORIGIN` on the API; never weaken CORS to `*` for a credentialed endpoint.

## Deployment

Deploy after the DB migration `20261013000000_iphone_text_autosave_details.sql` applies. Both Vercel projects (app and API) must deploy the same commit. Vercel's daily deployment quota may prevent auto deploys and requires verification before labeling the flow Production-ready.
