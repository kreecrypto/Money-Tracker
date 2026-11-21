# UX/UI audit remediation — 2026-11-21

Scope: Calendar-first Home, month summary, slip/manual entry navigation, Reports progressive disclosure, mobile readability, released Midnight Green theme. No changes to accounting formulas, OCR extraction, storage, network, or production deploys.

## Acceptance cases (required before merge)
- 320 / 375 / 390 / 430px: calendar numeric income/expense labels are legible and the selected date exposes exact amounts and transaction details.
- Monthly summary updates with month selection; net explicitly reads as **recorded income minus expenses**, not bank balance. Empty month displays zero without inventing a bank balance.
- Manual and scanner entry points both work in Live and are non-writing in Preview Demo; mobile buttons never obscure list content or navigation.
- Scanner heading back action returns to manual-entry form. Escape or modal backdrop close still works; non-saved OCR review warns before leaving.
- Reports show core overview first; additional analysis and review tools remain available in the native details disclosure.
- Test VoiceOver and physical iPhone Safari, including 320px dynamic type, dark theme contrast and safe-area insets.
- Run `npm test`, `npm run typecheck`, `npm run build` and screenshot/axe CI. Do not merge without verifying device screenshots.

## Not completed by a source-only patch
Physical iPhone test, OCR with real anonymized slips, screenshot QA and production validation must be confirmed separately. CSS legacy consolidation is a follow-up refactor; scope here avoids swapping or deleting released theme rules without screenshot regression proof.
