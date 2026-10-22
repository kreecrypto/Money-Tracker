# Connect Gmail via Google OAuth — Money Tracker

## Status
Implementation is **only on a reviewed feature branch** until approved and deployed. Without Google OAuth credentials, a dedicated Supabase migration, and a configured Vercel API runtime, the Home card reports "not configured". No user has linked Gmail and no mail has been read through this OAuth implementation.

## Scope
- First-party canonical web/PWA origin: https://money-tracker-beta-teal.vercel.app
- Google OAuth 2.0 authorization-code flow, PKCE S256 and sealed CSRF state with a 10-minute lifetime.
- Scopes: openid, email, gmail.readonly (NOT gmail.modify / gmail.send).
- Server exchanges Google code; identifies user using verified Google sub, NOT mutable email address.
- Refresh token encrypted with AES-256-GCM server-side; linked identity and session hash stored in RLS-protected Supabase table.
- Random 30-day server-only HttpOnly, Secure, SameSite=Lax session cookie; not the legacy iPhone Review Token. A single active browser session per Google identity in this minimal MVP.
- GET /api/gmail/connection returns ONLY actual connected state and masked email, never refresh/access tokens.
- POST /api/gmail/connection with authenticated, same-origin JSON disconnect removes the server connection, clears cookie and attempts Google OAuth token revocation.
- Home connection panel allows real Google consent redirect only when configured. No fake "Sync successful" claim.

## Setup required before physical QA
1. In Google Cloud Console, create/select a project and enable **Gmail API**. Configure Branding/OAuth consent and authorized test users as needed.
2. Create an **OAuth Client ID: Web application**. Authorized redirect URI must EXACTLY be:
   https://money-tracker-beta-teal.vercel.app/api/gmail/oauth/callback
   Test/preview domains require separate allowlisted callbacks and isolated credentials. Do not point Preview at Production database or OAuth config.
3. In **Money Tracker frontend Vercel project** server-side environment variables (NOT VITE_*), configure:
   - GOOGLE_OAUTH_CLIENT_ID
   - GOOGLE_OAUTH_CLIENT_SECRET
   - GMAIL_APP_ORIGIN = https://money-tracker-beta-teal.vercel.app
   - GMAIL_TOKEN_ENCRYPTION_KEY = dedicated random 64-hex characters (32 bytes)
   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (private, only on Vercel Functions)
   Set secrets via your provider UI, not in a repository or chat.
4. Apply the reviewed private migration:
   supabase/migrations/20261022191500_gmail_oauth_connections.sql
   It uses RLS and REVOKE; verify with a read-only schema/index/RLS query.
5. Run CI and private staging E2E for connection + callback, invalid state, token denial, stored-token encryption, disconnect and refresh-token revocation.
6. Complete Google OAuth restricted-scope verification / assessment requirements for any broader public launch, and publish privacy/consent policy covering financial email access.
7. After accepted merge/release, activate OAuth credentials, then test on real iPhone Safari and consent screen, deny/cancel/back, reload, expired cookie, disconnect/reconnect.

## Architectural limits
- This PR implements **Google OAuth Connect, status and disconnect**, NOT Gmail message ingestion, background polling, sync cursors or complete bank transaction import.
- Draft PR #73 separately proposes Gmail → Apps Script → API; it still uses a single-owner review token and is **not safe to reuse directly for multiple OAuth-linked Google identities**.
- Do not enable automatic finance writes until an OAuth-scoped Gmail importer uses a user-specific Supabase ledger with validated income/expense, robust duplicate indexes, Pending review, and browser reconciliation.
- The existing app's IndexedDB transactions and iPhone Review Token data are **not migrated or replaced**; the OAuth cookie only authenticates new Gmail endpoints.
- A Google Gmail.readonly scope is classified as restricted. Approval/verification and potentially a third-party security assessment may be needed to serve the general public.
- Disconnect attempts to revoke Google's refresh token but may fail if Google is unavailable; UI should inform user how to inspect/revoke authorization in Google Account permissions.
- Protect backend keys and access tokens: never store them in localStorage, VITE_* vars, browser cookies, screenshots, client analytics, GitHub files, or test logs.
- Do not log raw Google authorization codes, Gmail bodies, financial amounts, emails, auth cookies or secret values.

## PR acceptance gate
- [ ] CI/TypeScript/build green for exact PR SHA
- [ ] Migration reviewed but *not applied to Production* without approval
- [ ] Google consent flow verified using isolated test Gmail account and staging project
- [ ] Verified encrypted token at rest, state/PKCE rejection, session boundaries and CSRF protection
- [ ] Real iPhone Safari OAuth redirect and cookie persistence QA
- [ ] Explicit finance/security release approval before Production


## Direct Gmail API read-only test (same staged PR)

**Selected architecture:** Gmail → Money Tracker API → per-Google-identity ledger → App; no ChatGPT intermediary or Apps Script primary flow.

**Read-only slice (not financial import):**
- POST /api/gmail/scan requires a valid OAuth cookie, canonical same-origin JSON request and encrypted server-held refresh token.
- Gmail API messages.list searches the exact K PLUS sender within 30 days (maximum ten messages), then messages.get reads each MIME message.
- Exact sender plus DKIM authentication evidence for kasikornbank.com is required before any message can be marked Ready.
- Bounded text/plain body parsed with strict K PLUS parser. Unsupported HTML-only/ambiguous emails remain Pending, and unauthenticated mail is unverified.
- The browser sees aggregate counts only; no raw financial emails, bank references, account IDs, tokens or amounts are exposed.
- Home shows a manual test-only button after verified connection. API always responds mode=preview, saved=0; no data is persisted or counted in dashboards.

**Before turning on real auto-import:** configure Google OAuth, test sanitized real income and expense emails and HTML signatures, build user-scoped Supabase transactions plus idempotency and review, reconcile IndexedDB, add secure scheduler, pass isolated staging E2E and Safari QA, obtain restricted-scope approvals and release sign-off.

No production financial writes or schema changes are made in this direct-read slice.
