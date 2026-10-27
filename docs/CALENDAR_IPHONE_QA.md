# Calendar-First Home — iPhone Release QA

Scope: Money Tracker Calendar Home in PR #90, based on report-first PR #89. Never use real bank identities or slip photos in public GitHub issues, logs, screenshots, test artifacts, or analytics.

## Automated gates (not a substitute for device evidence)

- pnpm test, pnpm run typecheck, and pnpm build on the exact head SHA
- GitHub UX/UI Audit at widths 320, 375, 390, 430, 768 and 1280
- WebKit CI at 320, 375, 390 and 430, including daily income/expense display, tap-to-select, month navigation, and Saved/Pending UI
- Vercel Preview READY at the same SHA; do not use Production as a QA sandbox
- Accessibility: readable Thai amounts, VoiceOver date/amount labels, touch and focus, no horizontal overflow, safe-area, light/large-text settings

## Physical iPhone Safari and PWA (manual sign-off REQUIRED)

Record device model, iOS version, Safari/PWA mode, test date, exact SHA, and pass/fail for each case. Use a private anonymized expected-results table, and store it outside the public repo.

| ID | Test | Expected |
| --- | --- | --- |
| IP-01 | Fresh launch and reload | Calendar is the Home tab and selected month defaults correctly; no horizontal overflow |
| IP-02 | Prev/next month + month picker | Labels, weekdays, day counts (28–31) and amount totals correspond to the selected month |
| IP-03 | Tap a date, including an empty day | Selected border updates and detail lists only that date, with truthful empty state |
| IP-04 | Date with income and expense | Both figures appear separately; detail shows full precision; day/month sums reconcile with Saved ledger |
| IP-05 | Long amounts, Thai labels, large text and VoiceOver | No clipped critical amounts; spoken date, money and status are complete |
| IP-06 | iPhone Photos upload and camera capture for K PLUS | Slip input opens; OCR identifies date/time, amount and counterparty only if supported by evidence |
| IP-07 | Clear outgoing, incoming, ambiguous amount | Correct expense/income Saved; ambiguous stays Pending, excluded from calendar until confirmed |
| IP-08 | Upload same slip again | Duplicate not saved or counted twice |
| IP-09 | Top-up slip | Expense classification retained under current project rule |
| IP-10 | Home > Transactions > Reports > Settings navigation, modal, back | Tab bar unobstructed; no lost edits or stuck overlay |
| IP-11 | Background app, restart Safari and installed PWA | Data persists; selected monthly totals unchanged |
| IP-12 | Offline or failed sync | No fake Saved state; clear retry and truthful Pending; local records preserved |

## Release decision

- Any incorrect amount/date/classification, double count, data loss, broken camera, unreadable critical action, or privacy leak is a P0 blocker.
- Physical device results that were not observed must be UNVERIFIED, not Passed.
- For financially sensitive changes retain the private K PLUS image-golden gate and isolated staging whenever relevant.
- Keep PR #90 Draft until PR #89 dependency is reconciled, all automated checks are green for its final SHA, and a physical iPhone reviewer has signed off. Then merge via the normal reviewed process and verify the canonical Production domain.
