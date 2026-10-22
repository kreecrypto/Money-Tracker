# เงินวันนี้ — Money Tracker (Email-first product direction)

## Platform
Mobile-first web/PWA optimized for iPhone Safari. Not a native iOS app.

## Product north star — Email-first
Money Tracker is a private Thai-language **automatic income-and-expense tracker based primarily on connected bank-notification emails**. The intended daily journey is:

**Connect Gmail -> receive bank transaction notification -> extract & validate fields -> deduplicate -> save verified income/expense or queue an uncertain item for review -> refresh Transactions, Dashboard and Reports.**

**Uploading a K PLUS slip/photo, manual entry and local OCR are fallback workflows**, not the primary daily call to action. Do not remove them.

**Implementation status:** This is the target product requirement, not a claim that in-app Google OAuth, automatic mail polling or a cloud-first ledger is live. Current production is slip-first with IndexedDB; draft PR #73 proposes a manually installed Apps Script text bridge. UI must never claim Gmail is connected unless verified by a functioning integration.

## Initial scope
- Gmail provider first; bank notifications from **KBank / K PLUS** first.
- Both **income** (explicit incoming credit to an owned account) and **expense** (explicit outgoing transfer, PromptPay, bill payment, card/wallet top-up from an owned account).
- Own-account transfer should be excluded from income/expense; if account ownership cannot be established, queue for review, don't guess.
- Sender domain/format allowlist is a *filter* and cannot independently prove cryptographic authenticity. Never import promotional/statement/OTP/failed transaction mail as a completed transaction.
- Support other mail providers/banks only after privacy and format review.

## Primary user jobs
1. Link the mailbox safely with a clear permissions/consent explanation, and revoke access whenever wanted.
2. See an accurate mailbox connection status and last successful sync time.
3. Let qualified new emails save income and expense without uploading a slip or tapping Save.
4. Resolve missing amounts, ambiguous income/expense, bank/self-transfer classification and duplicate candidates from one Pending inbox.
5. See confirmed transactions reflected consistently in monthly income, expenses, net cash flow and Reports across trusted sessions/devices, without silently losing local-only records.
6. Use slip upload or manual entry only when an email is missing or the merchant receipt needs richer detail.

## Email-first Home information hierarchy
1. **Actual monthly net + income + expense** (never represent net as bank balance).
2. **Mail connection card**: not connected / connected / syncing / requires attention / disconnected; connected email displayed safely, last successful sync, any error and actionable reconnect/retry.
3. **Review inbox**: unresolved email or slip candidates count, direct action to resolve.
4. **Recent transactions** with source (Gmail, Slip, Manual), explicit +/- and date/time.
5. **Secondary actions**: Upload slip, Add manually, manage integrations.
Use the current green, quiet-finance design language and the existing 4-tab navigation.

## Primary onboarding
- First launch: explain Gmail-only bank-notification access, the implications of authorization, how account filtering works, and where records are stored.
- Preferred end-state: **Connect Gmail in the app using Google OAuth** plus a secure backend owner/session binding and opt-in consent.
- Interim MVP: users install the standalone **Google Apps Script** and authorize it *outside* the app; show **Setup required** and guide progress, never a fake one-tap Connect Gmail or fabricated sync status.
- First activation does not silently backfill historical email; ask separately before importing existing messages.
- In-app access to mailbox messages is not implemented by linking the Gmail connector to a ChatGPT conversation.

## Data and transaction rules
- Validate amount as positive safe integer satang; preserve genuine transaction date/time, bank reference, origin/source and traceable resolution status.
- **Saved** only when direction, amount, date/time, ownership confidence and transaction identity are sufficiently reliable.
- **Pending** if ambiguous or inconsistent; never count Pending in income/expense or reports.
- **Duplicate** if a repeated Gmail message ID, bank transaction reference, identical supported slip, or sufficiently strong reconciliation match is found. Do not falsely dedupe two genuinely distinct same-amount payments.
- **Skipped** for nontransaction, failed, promotional, OTP or excluded own-account transfers.
- Avoid persisting full email bodies, subject lines with PII, account numbers, bank images or OAuth tokens in transactions/analytics/logs. Store only necessary verified structured fields.
- Treat bank-notification mail as an evidence source, not as authoritative bank balance; users can reconcile against bank records.

## Security and storage direction
- A real one-tap Connect Gmail requires secure user authentication, OAuth callback/state/PKCE handling, backend encrypted token storage, token revocation/disconnect, explicit consent and restricted Gmail scopes.
- Google Gmail read-only API scope is a **restricted scope**: public launch can entail OAuth verification and third-party security assessment requirements. Complete the appropriate Google review before broad rollout.
- Never expose Gmail access/refresh tokens, Supabase service key, Apps Script secrets or review secrets in VITE_* variables, static JS, localStorage or logs.
- Existing production separates **local IndexedDB** (manual/slip records) and **Supabase** (API-confirmed imported records). A cloud-first source of truth and user-account-based ledger require a separate, reviewed migration with backup, owner mapping and no silent local deletion/overwrite.
- Until migrated, always state precisely whether a record is local or synced; the interim Review Token bridge is not an app-wide account identity system.

## Rollout priorities
P0: financial correctness, inbound/outbound parser evidence, duplicate/idempotency, secure ingestion, Pending, isolated staging.
P1: truthful mail connection and sync UI, user-scoped cloud ledger, paginated incremental sync, verified on-device iPhone Safari behavior.
P2: in-app Google OAuth integration for self-service linking subject to Google verification constraints; other banks/providers; advanced categorization and analytics.

## Brand and UI constraints
- Name: **เงินวันนี้**; minimal mobile-first, green/white, high contrast, Thai-first.
- Real user data only. No fabricated "Connected", imported-count, last-sync, bank balance or success toast.
- Show signed +/− values and color together; CTA >=48px; support iPhone safe areas, VoiceOver, normal and large text, 320–430px.
- One clearly primary Home action based on actual state: **Connect/setup mail** when not linked; **Review pending / View transactions** when linked. Slip upload is secondary, not removed.

## Source of truth and current execution
- Code currently: src/App.tsx, src/HomeScreen.tsx, src/IPhoneShortcutSettings.tsx, src/lib/iphoneSync.ts, src/lib/storage.ts, api/iphone/*.
- Email implementation under review: https://github.com/kreecrypto/Money-Tracker/pull/73
- Delivery architecture and migration plan: docs/EMAIL_FIRST_PRODUCT_PLAN.md.
- Design: DESIGN.md. Required workflow: docs/PROJECT_WORKFLOW.md and AGENTS.md.
- Production URL remains https://money-tracker-beta-teal.vercel.app; this spec does not authorize a deployment or trigger activation.

This is a product requirement change. Before shipping visible "Connect Gmail" behavior, demonstrate an actual backend integration and proper user consent.
