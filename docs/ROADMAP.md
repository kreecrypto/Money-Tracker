# Development roadmap

| Phase | Priority | Goal | Acceptance |
|---|---|---|---|
| P0 v0.1 | Done in source | Mobile dashboard, CRUD, monthly stats, budget, search, reports, backup | Build + logic tests pass; manual device QA still required |
| P1 v0.2 | Next | Recurring transactions templates, tags, date ranges, spend limits by category, better charts | Recurring entries require confirmation/preview; no duplicate postings |
| P1 v0.3 | Next | Optional encrypted cross-device sync through authenticated Supabase backend | RLS per user, encryption plan, backup migration tests |
| P2 v0.4 | Later | Multi-wallet balance tracking and transfers, opening balances, debt ledger | Consistent double-entry semantics and reconciliation |
| P2 v0.5 | Later | OCR receipt capture, smart category suggestions, push reminders | Consent, privacy controls, offline fallbacks |
| P3 | Later | Family/shared budgets and native Android/iOS packaging | Role permissions and threat model |

## Implementation milestones

- Day 1: Scaffold repo, app architecture, theme, local DB, data models.
- Day 2: Income/expense form, validation and CRUD.
- Day 3: Monthly overview, search/filter, category breakdown.
- Day 4: Reports, budget, import/export.
- Day 5: Mobile/desktop UI QA, automated tests, PWA.
- Day 6: Private GitHub repo, CI, and deployment preview.
- Day 7: Human UAT and improvements before live rollout.

These are *proposed milestones*, not evidence that future work is scheduled or already complete.
