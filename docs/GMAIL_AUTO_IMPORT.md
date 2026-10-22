# Money Tracker — K PLUS Gmail auto-import (income + expense)

## Scope & status
This is a gated API/finance integration. Do NOT enable against a real mailbox or merge to Production before isolated staging E2E, security review, and iPhone QA.
This change does not read historical mail, edit real Money Tracker rows, or enable Gmail triggers by itself.

## Architecture and account safety
- Google Apps Script scans only future K PLUS notifications from the exact sender kplus@kasikornbank.com every five minutes.
- The script uses Gmail message IDs (not thread IDs). Each message is processed separately even when Gmail threads contain many payments.
- Only transaction-specific lines are sent via HTTPS. Source bank account values are stripped; no full email text, images, accounts or OTPs are persisted.
- Vercel API POST /api/gmail/import independently validates caller token, sender address and transaction fields, then reuses saveDraft() and the private Supabase ledger.
- Server-only GMAIL_IMPORT_TOKEN must be a dedicated 64-character hexadecimal secret (not IPHONE_UPLOAD_TOKEN or IPHONE_REVIEW_TOKEN). Configure in the API project's Vercel environment.
- IPHONE_REVIEW_TOKEN is still required on the backend to map to the existing private ledger owner; avoid rotating it without a migration plan.
- Script Properties: MT_API_URL = your actual HTTPS API endpoint ending with /api/gmail/import; MT_API_TOKEN = same 64-hex GMAIL_IMPORT_TOKEN. Never put tokens in Git or the browser.
- Optional server-only GMAIL_OWN_NAMES = exact self-recipient names separated by | (pipe). Matches cause a same-name outgoing transfer to be skipped. For more precise owner-to-owner classification, compare bank-owned accounts in a future account-identity integration.
- Source label is KBank / Gmail; confirmed entries appear in the existing One-way iPhone ledger sync. The app still requires pairing with its Review Token and importing into IndexedDB.
- The first setup initializes a new cursor from the moment setup is executed. No automatic historical backfill.

## Income/expense decisions
- **Expense**: known K PLUS successful Funds Transfer / PromptPay Funds Transfer / Bill Payment / Cash Transfer subject PLUS an explicit debit/source-account cue.
- **Income**: explicit credit/incoming signal plus unambiguous transaction date/time, amount and transaction number. Do not treat "Received Name" (payee) alone as incoming cash flow.
- **Pending**: absent/reference or recipient for debit, amount/date-time conflict, or other incomplete/conflicting financial fields.
- **Skipped**: failure notices, unsupported/nonbank email and detected self-transfer (when self-recipient names are configured).
- Never classify OTP, a bank statement, promotional email, or credit-card statement as a transaction.
- Email incoming notification schema has not yet been verified using an actual incoming K PLUS email from this mailbox. Before activating incoming Auto Save in Production, use a real sanitized incoming example to confirm field and direction labels.
- For receipts & debit messages, values must be from Amount (THB) or จำนวนเงิน (บาท), never fee, merchant number or available balance.
- Thai and English transaction amounts, references and date/time must agree.
- Income with a known payer is displayed in its note because the existing server ledger has no dedicated sender column; expanding sender support is a separate schema/frontend task.

## Idempotency
- The same Gmail message has image_digest = SHA-256('gmail-kplus-message-v1|' + lowercase Gmail Message ID).
- Cross-source: bank_fingerprint = SHA-256('kbank-reference-v1|' + normalized KBank transaction number). This is the same identifier construction as the existing iPhone Photos import.
- Supabase already has unique indexes for owner_key+image_digest and owner_key+bank_fingerprint, but integration tests must verify the distinct-conflict paths and retries.
- Prior local-only IndexedDB slips have no shared cloud fingerprint and can still require manual reconciliation. Do not claim universal duplicate protection across devices.
- Pending and Confirmed share the bank reference unique index; don't create a second row when an email is resent or reprocessed.

## Install Apps Script after all gates
1. Confirm existing API health and use a stable endpoint from the configured Vercel API project (Money Tracker API).
2. Add GMAIL_IMPORT_TOKEN in the backend Vercel project, not the frontend/public VITE_* settings.
3. Visit https://script.google.com and create a project in the Gmail account that receives bank notifications.
4. Paste the repo file scripts/apps-script/gmail-money-tracker.gs.
5. Set Script Properties MT_API_URL and MT_API_TOKEN in Apps Script Project Settings.
6. Run setupMoneyTrackerGmail() and approve only the Gmail, UrlFetch and Script/Trigger scopes needed. It creates one time-based 5-minute trigger.
7. Inspect execution logs (counts only), staging fixtures and the Money Tracker Transactions screen.
8. Disable the trigger immediately if unusual import counts/amounts appear. Do not delete stored finance records during rollback.

## Release gates
Read AGENTS.md and docs/PROJECT_WORKFLOW.md. Required: parser/unit tests, API auth negative tests, production-secret audit, isolated staging database E2E, Gmail thread with two different message IDs, same email retry, duplicate Gmail+Slip reference, income credit format proof, Safari/iPhone sync and Dashboard totals. Have a human explicitly approve finance/API promotion. Merge only when gates are met; separately verify Production SHA and keep the canonical user app URL unchanged.

## Known follow-ups
- A strict 500-row limit in confirmedDrafts() requires paginated ledger sync for high-volume long-running automation.
- Server cannot identify every owner-to-owner transfer from self-recipient names alone; add bank account identity mapping before promising full automatic exclusion.
- Gmail sender text is not cryptographic bank certification; users should reconcile against bank statements and secure their Gmail mailbox.
