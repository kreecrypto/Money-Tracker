# Daily Minimal — Money Tracker v0.5.0

## Intent
Use Dime's **daily simplicity as a reference**, without copying its visual assets or proprietary screens. Original design built for Thai personal expense tracking; baseline 320–430px.

## Daily home
1. Compact month navigation, then recorded net cash flow (not bank balance).
2. One-tap **เพิ่มรายการ** and **สแกนสลิป** actions.
3. Latest six transactions, with a single overflow action menu per mobile row.
4. Slim monthly budget progress with accessible progressbar.
5. One clear link to the Reports page. Six-month trends and category analysis moved **out of Home**, not deleted.

## Kept intact
- IndexedDB local storage; no changes to transaction schema.
- OCR workflow, explicit money-in/out review, duplicate warnings, receipt handling.
- Add/edit/delete, monthly filters, settings, backup/restore confirmation, report export.
- Four destinations in bottom navigation and safe-area support.

## Visual system
Off-white canvas, simple white surfaces, green as the sole key action accent, 12–16px Thai labels, readable tabular financial numerals, 44px+ interactive controls, restrained dividers and no decorative gradients or shadows.

## Review gates
Run `pnpm test`, `pnpm build`, and UX/UI Audit workflow at 320, 375, 390, 430, 768, 1280px. Verify charts in Reports, Quick Add, OCR entry, budget and bottom nav. Physical iPhone Safari / bank-slip OCR still require manual device testing.

## Important
The home net amount is **the sum of recorded income minus expenses in the selected month**; it does not represent a bank account balance.
