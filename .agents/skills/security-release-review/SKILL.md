---
name: security-release-review
description: Review Money Tracker API authorization, privacy, data integrity, CI and Preview release evidence without adding runtime dependencies.
---

# Security and Release Review — Money Tracker

Use for server/API, sync, storage, backup, auth, and release-affecting changes. An original finance-specific checklist informed by the Agent Skills approach; **no external skill or network hook is installed**.

## Trust boundaries

1. Inspect actual callers and existing tests before speculating: browser OCR + IndexedDB; optional authenticated iPhone/API sync; Supabase; Preview/Production environments.
2. Check token rejection (missing/wrong/revoked), allowed origin and CORS behavior, server-side secrets, idempotent duplicate handling, input validation, ownership, errors and leak-free logs.
3. Check financial invariants: integer satang, Saved vs Pending vs Duplicate, classification uncertainty, atomic restore, delete confirmation and totals after reload.
4. Inspect whether real credentials, account names, original bank photos, OCR transcripts or finance values could land in source, browser bundle, CI log, screenshot or PR artifact. Do not echo them in review output.
5. Test API E2E only against separately provisioned isolated staging data. **Never connect Preview to Production Supabase** merely to make health checks pass.

## Verification and decision

- For code changes run focused regression(s), `pnpm test`, `pnpm run typecheck`, `pnpm build`. Use repo's CI, UX/UI, WebKit and Impeccable workflows as applicable.
- Check the exact PR head SHA and check-runs; Vercel READY means deployed, not that real OCR/financial device acceptance passed.
- Record severity, affected files/entry points, repro, fixed/blocked state, test evidence and residual risk. Require explicit sign-off for real-device P0 and financial/API changes.
- If isolated staging or physical iPhone evidence is absent, report the gate **blocked**. Do not assume tests ran.

Tracking: [P1 security #70](https://github.com/kreecrypto/Money-Tracker/issues/70), [P0 OCR #67](https://github.com/kreecrypto/Money-Tracker/issues/67), and [PR #63](https://github.com/kreecrypto/Money-Tracker/pull/63).
