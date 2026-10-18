# Impeccable UX/UI Audit — Money Tracker (2026-10-18)

## Scope and evidence

- Product context: `PRODUCT.md` and `DESIGN.md` on `main`, north star **Quiet Financial Clarity**.
- Screens reviewed at source level: Home, Transactions, Reports, Upload Slip / OCR results, Pending, and Settings.
- Platform: Thai-first mobile web/PWA for iPhone Safari; not a native iOS app.
- Baseline: `main` commit `713348d491284ef5c77b1ce4bfadd4502465a3da`.
- Method: Impeccable-inspired critique (hierarchy, clarity, cognitive load, interaction) and audit (a11y, responsiveness, consistency). This source review alone is not a rendered screenshot acceptance or physical-iPhone test.

## Prioritized findings and changes

| Priority | Finding | Change in this branch | Verification |
| --- | --- | --- | --- |
| P1 | An incoming transfer can display the user's own **recipient/payee** instead of its recognized **sender**; the data model distinguishes both fields. | `transactionDisplayName` selects the identified sender for income; existing `recipient` values remain intact. Home details show sender and recipient separately; Transactions uses the same display rule. | `tests/finance.test.ts`, browser screenshots, sample income/expense K PLUS slips |
| P1 | Manual income entry offered only a field labelled “ชื่อผู้รับ,” although the user's useful counterparty is the payer. | New optional sender field for income; expense continues to edit payee. Existing printed payee is preserved when editing OCR imports. | New income entry, edit OCR-derived income and compare exported data |
| P1 | OCR result labels can be mistaken for the same saved state. | Explain saved, duplicate and pending at the batch summary; call the OCR field “ชื่อผู้รับตามสลิป” and show captured sender separately. | Mixed 3-image batch: one saved, one duplicate, one pending |
| P2 | The Home month listbox lacked arrow/home/end keyboard navigation and focus-on-open. | Selected option focuses on open; ArrowUp/ArrowDown/Home/End navigate options; Escape restores trigger focus. | `scripts/webkit-visual.mjs` |
| P2 | The six-month trends graphic didn't expose the month-by-month values to screen readers. | Added visually hidden data table with an explicit caption and month/income/expense headers. | Screen reader reading order and Chromium axe audit |
| P1 | CSS is split across six layered stylesheets with several legacy `!important` overrides; changes can regress Safari. | Removed a legacy 9px month-label rule; left broad CSS refactor out of this safety-scoped PR. | Computed styles at 320, 375, 390, 430, 768, 1280px + physical Safari |
| P1 | Detector CI used `--no-design-system` and couldn't check project-specific design context. | Detector now runs `npx --yes impeccable detect --json src/` with `DESIGN.md`. Findings remain advisory **until triaged**, not silently classified as passing design QA. | Review GitHub Actions artifact `impeccable-design-findings` |

## Screens: critique and remaining recommendations

### Home
- Preserve order: monthly net → income / expense → upload → recent transactions.
- Do not call monthly net a bank account balance.
- Review warning density if Pending, Sync, owner-name, and backup reminders coexist.
- Verify long Thai names, negative values, VoiceOver, and focus return after transaction details.

### Transactions
- Keep separate OCR sender and recipient fields; do not swap them in stored data just to change UI copy.
- Verify manual income editing preserves any existing OCR recipient.
- Differentiate Saved from Pending in labels and totals; Pending must not count toward net.

### Reports
- Read six-month values through the table in addition to the visual chart.
- Check color-independent income / expense legends and long labels.
- Preserve real-data-only policy. Do not fabricate missing trend values.

### Upload Slip and Pending
- Avoid automatically saving missing/ambiguous amounts as zero; use Pending.
- Check that a TrueMoney top-up stays expense where classified by existing rules.
- Verify the original slip image is only held temporarily in-memory, and Pending notices are truthful about persistence.
- Check duplicate import does not create another row.

### Settings
- Keep owner-name setup easy to discover when OCR direction is ambiguous.
- Keep integration and diagnostic settings progressively disclosed.
- Confirm backup/export before destructive reset, and ensure focus and keyboard remain usable.

## Required gates before merging

1. **Official source detection**: inspect the actual `impeccable-findings.json` artifact, triage all P1 findings, and document any narrow, intentional exceptions. Exit 2 means primary findings, not a pass.
2. **CI**: TypeScript check, unit tests, build, Chromium axe/UX acceptance, and WebKit visual checks must pass on this PR SHA.
3. **Real iPhone**: Safari (normal tab), PWA cold launch, 320–430px widths, keyboard open/dismiss, safe area, month menu, transaction modal, VoiceOver.
4. **K PLUS E2E**: Known amount/date/time/sender/payee slip, ambiguous OCR, duplicate, batch import, Wallet top-up and Saved/Pending totals.
5. **Visual comparison**: Compare Home / Transactions / Reports / Upload / Settings to approved Money Tracker Home design-system reference using actual screenshots.
6. **Release**: No merge/deploy until documented evidence; then confirm `money-tracker-beta-teal.vercel.app` resolves to the approved production SHA and smoke-test.

## CLI reference

```bash
npx impeccable detect --json src/ > impeccable-findings.json
```

Impeccable's slash commands are coding-agent instructions, not shell binaries; execute them in a compatible agent harness after installing the official skill. The source detector in GitHub Actions is separate from the manual critique and cannot replace real-device QA.

## Current status

This branch proposes scoped UI/semantics and QA improvements only. **No backend/OCR inference/storage schema changes; no production deploy.**
