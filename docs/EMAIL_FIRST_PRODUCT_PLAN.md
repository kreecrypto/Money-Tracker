# Email-first Money Tracker — Implementation Plan and UI Contract

Status: **product direction accepted / not yet implemented or deployed**. Canonical domain stays https://money-tracker-beta-teal.vercel.app. Existing Draft PR #73 is a proposed **Apps Script ingestion bridge** for K PLUS, not a complete in-app Gmail linking feature.

## 1. Verified existing architecture (as inspected on 22 Oct 2026)
- src/HomeScreen.tsx has monthly summary -> prominent **อัปโหลดสลิป** -> recent transactions.
- src/App.tsx loads local finance rows from IndexedDB, and periodically runs iphoneSync() to copy confirmed Supabase entries into IndexedDB when the existing Review Token is configured.
- src/lib/iphoneSync.ts assumes the limited server endpoint /api/iphone/ledger, imports one-way; local-only manual/photo rows are not cloud-synced.
- server/iphone/bridge.ts computes a single-owner ownerKey() from IPHONE_REVIEW_TOKEN and uses the private Supabase money_tracker_iphone_drafts table.
- Draft PR #73 adds POST /api/gmail/import, a text/parser bridge and an external 5-minute Apps Script trigger. There is no in-app Google OAuth, connected-mail status API, or cloud-authoritative multi-account ledger yet.
- A real bank email's sender line by itself is not sufficient sender-authentication evidence; the mailbox and notifications require threat-model review.

## 2. Target email-first user journey
1. First visit sees monthly dashboard only with real local values, plus **เชื่อมอีเมลเพื่อบันทึกอัตโนมัติ** as primary onboarding.
2. Explain precisely: Gmail access purpose, only supported bank messages processed, retained fields, data storage, revoke/disconnect and re-import option.
3. Upon genuinely linked Gmail, show masked address, accurate connection status and **last successful synchronization**; else show setup instructions or an actionable error.
4. New bank notification from KBank is parsed on the server; a new reliable incoming credit -> **รายรับ**, outgoing debit/payment/top-up -> **รายจ่าย**.
5. Reject nonfinancial, promotional, failed, OTP and untrusted-source messages.
6. Detect exact Gmail message reprocessing and KBank transaction-reference duplication. Candidate duplicates against existing **local-only** slips require additional client-side reconciliation and must never be silently double-counted.
7. Transactions/Reports show imported and user-entered records, accurately scoped by device/sync state. Pending items don't affect totals.
8. User can pause automation, disconnect Gmail, review consent, export data and optionally continue manual/slip entry.

## 3. Proposed UI by screen
### Home
- Preserve monthly net, income, expense hero.
- First action card *when unlinked*: icon mail, title **เชื่อม Gmail**, copy **นำเข้ารายรับ–รายจ่ายจากอีเมลธนาคารอัตโนมัติ**, CTA **เริ่มเชื่อมต่อ** only when a working OAuth path exists. Until then CTA must truthfully say **ดูวิธีตั้งค่า Gmail** and open actual setup guidance.
- When linked: replace onboarding card with **Gmail เชื่อมต่อแล้ว** only after verified backend state, masked account, actual last sync time and **ซิงก์อีกครั้ง** only if backend supports it.
- Pending count with **ตรวจรายการรออนุมัติ**; never show a fake count.
- Secondary row: **อัปโหลดสลิป** and **เพิ่มรายการเอง**. Keep original OCR and receipt options functional.
- Recent list indicates **Gmail**, **สลิป**, **เพิ่มเอง**, without mixing local and cloud status ambiguously.

### Transactions
- Filters: all / income / expense / pending; optional verified origin chips.
- Each row displays actual amount sign, date/time, source and any dedup/review explanation.
- Resolving a Pending amount or direction is explicit and audited; repeated import must not recreate discarded records silently.

### Settings -> เชื่อมต่ออีเมล
- Not connected, setup required, connected, syncing, attention required, paused, disconnected (backend-derived).
- Actual Gmail address masked; permission explanation; last successful sync; imported vs duplicates/pending counters (only if sourced from server).
- Link/reconnect, pause/resume, disconnect; no raw token fields in the preferred OAuth experience.
- Interim Apps Script instructions are labeled **ตั้งค่าผ่าน Google Apps Script** and shown distinctly from an OAuth account link.

### Reports
- Income, expense and monthly net use the reconciled confirmed ledger.
- Show data freshness and a warning when some records are local-only or the mail link has failed.
- No claims of complete banking history or live bank balances.

## 4. Two technical stages — do not conflate
### A. MVP — external Apps Script, one owner
- Complete and review PR #73 using private redacted examples; keep it Draft until staging + finance QA pass.
- Setup script manually in user's Gmail, use Script Properties for the importer secret, and a real API connection test.
- Connection status UI can show **setup required / import operational** only with verified server-side heartbeat; Apps Script itself is not an in-app Gmail OAuth link.
- Mail scanning every approximately five minutes, not instant delivery; no historical imports without separate consent.
- Prevent conflicting counts while existing local-only IndexedDB stores remain.

### B. Product-grade Gmail linking inside app
- Design OAuth Consent -> Google OAuth code flow -> verified backend callback with state/PKCE -> securely associate Gmail identity with authenticated Money Tracker user.
- Request the minimum Gmail read-only permissions that actually meet the requirement; restricted scopes can require Google verification and security assessment for externally published apps. Avoid assuming that a ChatGPT Gmail connection supplies app credentials.
- Keep short-lived access tokens and refresh tokens in protected backend storage; encrypt, rotate and revoke, never browser storage.
- Replace Review-Token-derived single-owner identity with authenticated user-scoped Supabase/RLS; migrate local and cloud records only with backup and clear conflict handling.
- Implement server-side message cursor/pagination, durable import jobs/retry, explicit error/last-sync telemetry, idempotent bank-reference upsert; handle OAuth expiry/reconnection.
- Optionally use Gmail Pub/Sub watch/history for faster notification, but implement watch renewal, missing history recovery and idempotent retries.
- Integrate Home/Settings link states with real API endpoints and end-to-end tests.

## 5. Nonnegotiable financial rules
- Incoming credit -> income only with explicit signal that an account owned by this user was credited.
- Outgoing bank transfer/bill/PromptPay -> expense only if not a verified own-account transfer. K PLUS top-up from a bank account -> expense under existing product convention.
- Own-account transfer: excluded, never counted twice; uncertain ownership -> Pending.
- Two TH/EN blocks for one email -> exactly one transaction.
- Same Gmail message -> one. Same reference via Gmail + screenshot -> one. Do not collapse two same-amount same-day transfers if references differ.
- References, amounts, timestamp, sender/receiver must be consistently normalized in Thai and English; fail safe on conflicting values.
- Amount is integer satang, not available balance or fees; verify notification totals against independent evidence.
- Supported KBank incoming-email examples must be validated before enabling incoming Auto Save on real accounts.

## 6. Delivery sequence and acceptance
**P0 data integrity/security -> P1 UX/sync -> P2 additional providers.**

1. Align PRODUCT.md, DESIGN.md and this plan (docs-only PR).
2. Review/fix ingestion PR #73 using unit tests, synthetic adversarial cases, isolated staging Supabase API tests, duplicated sends and actual sanitized K PLUS incoming/outgoing emails.
3. Build real connection-state API and persistence (interim setup status or OAuth target), add genuine linked/error/pending UI to Home/Settings, keep upload/manual accessible.
4. Incrementally migrate sync from fixed latest-500 API and per-browser IndexedDB toward a user-scoped cloud ledger with pagination, backup-first and no silent data loss.
5. QA iPhone Safari/PWA at 320, 375, 390, 430, normal/large text, offline/reload, consent, revoke, duplicate imports and totals; full CI and isolated staging.
6. Financial/security sign-off -> Merge -> Production exact SHA check -> smoke test; enable mail trigger or OAuth only once actual permissions/credentials and controls are ready.

**Definition of Done:** A linked mailbox processes a new verified incoming or outgoing notification without uploading a slip; every distinct transaction appears exactly once on Transactions and totals; error/ambiguous inputs go to Pending, users can see actual synchronization state, and can revoke the link without losing already saved records. Until this is proven, don't label Email-first functionality as live.
