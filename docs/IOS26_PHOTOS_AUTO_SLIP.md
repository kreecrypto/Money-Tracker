# iOS 26 Photos Auto Slip Sync — Money Tracker

## What this does

Use **Apple Shortcuts personal automation** to inspect recent Photos on the iPhone AFTER a bank app is closed. On the iPhone, **Extract Text from Image** first; local keyword screening keeps personal images off the Money Tracker service. **Send only text from images already identified as likely bank receipts** to a secure API. The server parses transaction fields, removes bank balances, and creates a **pending** draft. No accounting entries are confirmed without human review.

This is **NOT a photo-created trigger** and is **not guaranteed to run the instant a bank app saves a slip**. A fallback time-of-day scan or an on-demand Share Sheet Shortcut is appropriate. Some bank apps don't automatically save slips into Photos: in that case the Shortcut has nothing to scan. iOS permissions or locked-state behavior can also prevent a background run.

## Flow

\`\`\`mermaid
flowchart TD
 A["Bank app saves receipt into iPhone Photos"] --> B["iOS Shortcuts Personal Automation: App Is Closed"]
 B --> C["Wait briefly for Photos to finish indexing"]
 C --> D["Find Photos: created recently, newest first, limit 5-10"]
 D --> E["Repeat with Each -> Extract Text from Image on iPhone"]
 E --> F{"Contains banking/transfer words AND transaction amount label?"}
 F -->|No| G["Skip — never upload personal photo"]
 F -->|Yes| H["POST only OCR text to /api/iphone/photos"]
 H --> I{"Authenticated / bank receipt recognized?"}
 I -->|Not a receipt| J["Skipped, no storage"]
 I -->|Duplicate| K["Duplicate, no second draft"]
 I -->|New| L["Private Supabase staging draft: pending"]
 L --> M["Money Tracker Settings -> iPhone Shortcut -> Review"]
 M -->|Cancel| N["Discarded — no transaction"]
 M -->|Confirm corrected details| O["Confirmed -> IndexedDB sync -> dashboard / reports"]
\`\`\`

## Prerequisites for actual operation

1. App version containing \`/api/iphone/photos\` must be deployed behind a **public HTTPS bridge host**. Current Vercel authentication for Money Tracker must remain protected; Shortcuts requires an independently accessible endpoint.
2. Owner has approved a **new, dedicated** Supabase project for Money Tracker and deployed \`supabase/migrations/20261010114100_iphone_shortcut_drafts.sql\`.
3. Vercel server environment variables:
   - \`IPHONE_UPLOAD_TOKEN\`: 64 hex characters generated securely and stored **only on the server and in your personal Shortcut**.
   - \`IPHONE_REVIEW_TOKEN\`: **different** 64-hex-character token used for viewing/reviewing entries in Money Tracker only.
   - \`IPHONE_ALLOWED_APP_ORIGIN\`: exact Money Tracker app URL, e.g. \`https://money-tracker-beta-teal.vercel.app\`
   - \`SUPABASE_URL\`, \`SUPABASE_SERVICE_ROLE_KEY\`: dedicated Money Tracker database only, server-side.
4. Vite frontend public variable \`VITE_IPHONE_BRIDGE_URL\` = public HTTPS host. Never prefix secret tokens with \`VITE_\`.

**Do not share any token in ChatGPT, GitHub issues, screenshots or public Shortcut/iCloud shares.** Store the upload token in your own private Shortcut. If the Shortcut is shared or the phone is lost, rotate tokens using Vercel and reconnect browsers.

## Build Shortcut #1: "Money Tracker — Scan Photos"

1. Open **Shortcuts** → **+** → New Shortcut → name it **Money Tracker — Scan Photos**.
2. Add **Wait** 5–10 seconds. Bank apps may take time to save photos after closing. Background execution time depends on iOS; if a wait fails, omit the wait and rely on the scheduled safety scan.
3. Add **Find Photos** (ค้นหารูปภาพ) with:
   - **Created Date / Date Taken**: within the last **15–30 minutes** (choose whichever date field matches when the bank saved slips; imported images can have different capture timestamps). If the installed Shortcuts filter does not offer a rolling-minutes option, use a calculated cutoff date and filter results locally.
   - Sort: most recent first.
   - Limit: **5–10 photos maximum**, not the entire library.
   - Optional: if you prefer strict opt-in, select a separate **Money Tracker Slips** album; this requires moving bank slips there manually or with another approved automation.
4. Add **Repeat with Each** photo returned by Find Photos.
5. Inside Repeat, add **Extract Text from Image** and provide **Repeat Item**. This first-stage OCR runs on the iPhone; no picture is sent to Money Tracker.
6. Filter text **locally**, using If and nested conditions:
   - Condition A: OCR contains **โอน** OR **สลิป** OR **โอนเงินสำเร็จ** OR **รับโอน** OR **transfer**.
   - Condition B: OCR contains **จำนวนเงิน** OR **ยอดโอน** OR **ยอดชำระ** OR **amount**.
   - To prevent unrelated photos uploading, require **both** A AND B; when not met, end the iteration. For multiple OR cases build nested If conditions or collect matches into a boolean variable; action labels differ slightly by language/iOS version.
7. For matched photos only, use **Get Contents of URL**:
   - URL: \`https://<public-bridge-host>/api/iphone/photos\`
   - Method: **POST**
   - Header: \`Authorization\` = \`Bearer <IPHONE_UPLOAD_TOKEN>\`
   - \`Content-Type\`: \`application/json\`
   - Request Body: **JSON** object with one Text key **text**, set its value to the **Extract Text from Image** result. No image upload in this path.
8. Optionally get \`status\` from the returned dictionary:
   - \`pending\`: created a new review draft
   - \`duplicate\`: same recognized slip was seen before
   - \`skipped\`: not a suitable receipt
   - \`401\`: invalid token; \`503\`: bridge/db not ready; check service config.
9. Do **not** show receipt details in lock-screen notifications. A count of new drafts is enough.

**Do not POST personal photos or entire Photos albums.** The backup \`/api/iphone/upload\` image endpoint is for consciously sharing a particular image, not bulk automatic scanning.

## Automation #1: when bank app is closed

In **Shortcuts → Automation → + → App**:
- Select **K PLUS** and any other bank apps you use.
- Select **Is Closed** (not opened).
- Select **Run Immediately** / disable Ask Before Running when available; choose the Shortcut **Money Tracker — Scan Photos**.
- Grant Photos and network permissions as requested by iOS.
- First test while unlocked; locked-state execution may be limited depending on iOS permissions and actions.

A bank may save the image a little AFTER the close event. Do a manual trial and use the optional scheduled scan as fallback.

## Optional Automation #2: scheduled catch-up

Add **Time of Day** triggers using the same Shortcut to scan receipts missed by App Is Closed (choose your own morning/evening times). Use a **30-minute window** if scans run frequently. If only one nightly scan, extend the window appropriately with a bounded photo count and local OCR screening.

The server's SHA-256 digest of normalized OCR text plus database UNIQUE constraint prevents multiple creates when the same photo is seen repeatedly. This does not replace human review.

## Confirm inside Money Tracker

Open **Money Tracker → ตั้งค่า → iPhone Shortcut**; enter \`IPHONE_REVIEW_TOKEN\` the first time, refresh, then inspect every pending draft. Verify amount, date, bank, category, and whether it is:
- a genuine expense;
- income;
- a transfer between your own accounts (**discard**, otherwise double-counting).

Press **ยืนยันบันทึก**; confirmed records become available through the authenticated ledger API and are imported into the existing browser IndexedDB. No two-way cloud sync yet. Existing local entries are not overwritten.

## QA checklist

- [ ] New Photos receipt found after closing K PLUS, using an actual iPhone 26.
- [ ] Unrelated picture or screenshot is not sent to the API.
- [ ] API rejects unknown bearer token (401); missing deployment secrets fail closed (503).
- [ ] KBank Live -119.00 entry vs balance 400,070.79: only 119.00 is identified.
- [ ] Bank transfer to own account is discarded during manual review.
- [ ] Exact same OCR text sent twice creates one pending item.
- [ ] Confirmed item appears in Money Tracker transactions/reports exactly once.
- [ ] Background operation is tested when unlocked and locked.
- [ ] No raw image, bank account number, bank balance, or OCR text appears in database or logs.
- [ ] Offline/failed API calls do not present a false success notification.

**Critical:** The current implementation is a **single-owner MVP**, not a public multi-user authorization design. The backend/token/db/deployment and physical iPhone QA must complete before calling it operational.

## Apple references

- [Create a personal automation](https://support.apple.com/guide/shortcuts/intro-to-personal-automation-apd690170742/ios)
- [Find and filter photos](https://support.apple.com/guide/shortcuts/add-filter-parameters-to-find-and-filter-actions-apdbdab3433f/ios)
- [Get Contents of URL and JSON request bodies](https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios)
