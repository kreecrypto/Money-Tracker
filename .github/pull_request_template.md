## Task / scope
- Linked Issue: Fixes #
- Priority: P0 / P1 / P2
- Change type: docs-only / UI / OCR-finance / API-sync-security / deployment
- Main user flow, expected result and affected files:
- Base / head SHA inspected:
- Risk, privacy impact and rollback:

## Delivery workflow gate

Use [docs/PROJECT_WORKFLOW.md](../docs/PROJECT_WORKFLOW.md). Mark `N/A` with a reason in *Evidence* where genuinely not applicable, not `Pass`.

- [ ] **00–02** Priority, acceptance and latest source/PR inspected; relevant repo-local skills selected
- [ ] **03** Small scoped implementation, caller impact and finance/privacy rules checked
- [ ] **04** Focused regression plus `pnpm test`, `pnpm run typecheck`, `pnpm build` (or docs-only format checks)
- [ ] **05** UX/UI Accessibility + WebKit/Safari checks where affected
- [ ] **06** GitHub CI on latest head SHA verified; review findings addressed
- [ ] **07** Exact Preview SHA and flow QA; isolated staging E2E for API/sync where affected
- [ ] **08** Physical iPhone Safari/PWA, private K PLUS images, duplicates/Pending and persisted totals where affected
- [ ] **09** Human release decision/sign-off obtained for financial or API Production changes
- [ ] Blockers and unrun checks explicitly noted; no secrets, real slips or PII posted

## Evidence (must be accurate)
- Tests / commands and pass-fail:
- GitHub Actions run links:
- Preview URL / SHA:
- Sanitized UX evidence:
- Private real-image iPhone matrix: PASSED / BLOCKED / N/A (reason)
- Isolated staging API E2E: PASSED / BLOCKED / N/A (reason)
- Reviewer / release decision:
- Outstanding blocker / next action:

## Post-merge (fill in before closing issue, not an assumed PR result)
- Main merge SHA:
- Production deployment SHA and canonical URL actually verified:
- Smoke test results:
- Rollback / follow-up:
