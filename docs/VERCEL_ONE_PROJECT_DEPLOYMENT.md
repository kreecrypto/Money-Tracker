# Money Tracker — One-project Vercel deployment

## What changes
- Frontend (React/Vite) and `api/iphone/*` serverless functions are built from the **same GitHub repository and the same Vercel deployment**.
- Supabase remains the managed backend for iPhone Shortcut text imports; ordinary entries and on-device photo OCR **remain in browser IndexedDB**. This migration does **not** claim to sync all entries across devices.
- When `VITE_IPHONE_BRIDGE_URL` is **unset**, the app uses its own HTTPS origin for `/api/iphone/drafts` and `/api/iphone/ledger`. Existing deployments with an explicit HTTPS bridge URL continue to work.
- API review requests work on the same origin, and an explicitly permitted legacy origin may still use CORS. **Bearer token authorization is mandatory** in either case.
- Existing iPhone Shortcuts using the old API domain can continue to use that domain, provided it remains mapped to this same Vercel project.

## Controlled consolidation steps
1. Keep the **existing backend-configured project** as the release target. It already has server-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `IPHONE_UPLOAD_TOKEN`, `IPHONE_REVIEW_TOKEN`, and `IPHONE_ALLOWED_APP_ORIGIN`. Never copy private keys into Git or client-side `VITE_*` variables.
2. Deploy and test this source on that project. The serverless API functions are already in `api/iphone/`; **no schema or database move is needed**.
3. Confirm `GET /api/iphone/health` returns `{"status":"ok","storage":"ready"}` and `GET /api/iphone/upload` is denied with 405. Confirm the SPA renders, its JS/CSS assets load, and CI has passed.
4. Assign the existing `money-tracker-beta-teal.vercel.app` domain to the tested combined deployment. **Preserve the domain** so existing IndexedDB entries and locally saved Review Token remain on the same browser origin.
5. Confirm the public domain now serves the new build and its own `/api/iphone/health` returns ready; confirm unauthenticated review/ledger routes still return 401, not financial records.
6. Update iPhone Shortcut URL to `https://money-tracker-beta-teal.vercel.app/api/iphone/photos` during device QA (the old API URL may remain as a compatibility alias). Validate with a *non-sensitive test notice* and check duplicate prevention; do not transmit real credentials in logs.
7. Keep the original frontend-only deployment as a **rollback candidate**, with its existing external API bridge URL. Do not delete it until iPhone device UAT and private-data backup have been checked.

## Rollback
- If the combined production deployment fails, point the `money-tracker-beta-teal.vercel.app` alias back to the last known-good standalone frontend deployment.
- Keep the original backend/API deployment and its environment variables intact; the old frontend build still uses `VITE_IPHONE_BRIDGE_URL` to reach it.
- Never change the public app domain to a new hostname without an IndexedDB export/restore strategy: IndexedDB data is scoped to origin.

## Verification boundaries
- Automated Vercel tests cover build, parser behavior, CORS, auth, and UI regression checks. A **real iPhone Shortcut + Safari** roundtrip still requires device-level QA.
- No Supabase schema migrations, record exports, service-key rotation, or browser IndexedDB copying are part of this change.
