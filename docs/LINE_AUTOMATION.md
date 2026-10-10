# LINE Chat → Money Tracker Automation

## Status
- DONE (code in feature branch): signed webhook handler, Thai transaction parser, RLS-protected Supabase staging inbox migration, parsing tests.
- NOT LIVE: no LINE Official Account credentials, dedicated Supabase Money Tracker project, approved cloud login/linking, or Money Tracker browser sync.
- Images/slips, daily alerts, and cloud ledger UI are NOT yet implemented.
- Do not merge/deploy to production before completing authentication, dedicated storage, and end-to-end security QA.

## Phase 1 — LINE text inbox

Send a direct chat to the Money Tracker LINE Official Account, not a personal chat or group.

Examples:
- กาแฟ 65 → expense ฿65 / food / cash
- จ่าย 120 ค่าแท็กซี่ โอน → expense ฿120 / transport / bank
- รับ 5000 งานเสริม → income ฿5000 / side income
- เงินเดือน 55000 → income ฿55000 / salary

The bot verifies the LINE signature against the raw request body, ensures the sender is allowlisted, parses a single amount with an unambiguous direction, inserts into a Supabase staging inbox (idempotent UNIQUE LINE event id), and replies with a confirmation. Conflicting directions or multiple amounts are not saved.

The web app does NOT yet show these records because it only reads local IndexedDB. This is a staging implementation only.

## Setup required

1. Create/identify a LINE Official Account; enable Messaging API; obtain Channel Secret and Channel Access Token.
2. Approve a new Supabase project dedicated to Money Tracker. Never reuse UTP or other projects without explicit approval. Apply the SQL migration in supabase/migrations/20261010000000_line_inbox.sql.
3. Configure SERVER-ONLY environment variables: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, LINE_ALLOWED_USER_IDS, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
4. Deploy webhook to a *separately scoped PUBLIC host*: the current Money Tracker Vercel app requires Vercel Authentication, so LINE cannot call it unauthenticated. Public webhook traffic must pass HMAC verification, allowlist and rate limits. Do not turn off whole-app Vercel protection as a side effect.
5. In LINE Developers, configure POST webhook URL; enable Use webhook; verify signed empty-event request HTTP 200.
6. Verify unauthorized signatures 403, missing credentials 503, duplicate LINE delivery creates one row, and only authorized sender events are saved.

Never commit secrets or prefix them VITE_, which would expose them in frontend bundles. Keep Supabase service-role token server-only.

## Phase 2 — Secure Money Tracker app synchronization (required)

- Add actual user authentication (e.g. Supabase Auth) and LINK the LINE ID using a validated LINE Login / LIFF token or a server-issued short-lived pairing flow. Never trust an unverified LINE ID from the browser.
- Secure row ownership using RLS and implement idempotent transactions sync.
- Back up local IndexedDB transactions and ask approval for one-time data migration/merge; do not delete or silently replace records.
- Show LINE-sourced transactions in the home, transaction list and reports, including offline/error/conflict states.
- Test cross-device access and protect all private data from other users.

## Phase 3 — Optional improvements

- LINE slip images → retrieve content → private OCR → REQUIRE review/direction confirmation before saving.
- LINE push notifications, monthly reports and overspending alerts with user opt-in and message quota awareness.
- LIFF app to view ledger in LINE.

## QA gates

- Parser unit tests and Vite build
- Webhook verified signature/raw body, forged signature denial, allowlist and replay deduplication
- LINE Official Account real user test, database failure handling, idempotency
- Auth/RLS per-user integration tests
- React mobile browser UX regression and iPhone LINE in-app tests

## References

- https://developers.line.biz/en/docs/messaging-api/getting-started/
- https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/
- https://developers.line.biz/en/docs/messaging-api/receiving-messages/
- https://vercel.com/docs/functions/runtimes/node-js
