# Money Tracker — Expense category decision guide (2026-11-03)

Scope: expense selection and **conservative** category suggestions only. This is a product rule, not a bank-certified accounting standard.

## Purpose first, payment channel second

A category should describe **what was bought or paid for**, rather than the account, wallet, shop brand, or person receiving a transfer. Do not infer goods from a multitype merchant (7-Eleven, PTT, HomePro, Shopee, Lazada) or a person's name. New labels are selectable for new and edited records; **no bulk migration** of existing local transactions occurs.

| Main category | Examples / boundaries |
| --- | --- |
| อาหารและเครื่องดื่ม | Meals, coffee, snacks, drinks; use item-level evidence for convenience stores |
| ของใช้ประจำวัน | Cleaning liquids and consumables; not food |
| บ้านและค่าน้ำไฟ | Rent, water, power and building common fees; not phone or internet |
| โทรศัพท์และอินเทอร์เน็ต | Telecom plans and home internet; not media subscriptions |
| เดินทาง | Transit, fares, taxis; Easy Pass *top-up* is a cash movement |
| รถยนต์และยานพาหนะ | Proven fuel, parking, repair and actual toll usage; PTT alone is insufficient |
| สุขภาพ | Treatments, hospitals, pharmacies; premiums belong to insurance |
| ประกันภัย | Proven premiums and compulsory motor insurance |
| ช้อปปิ้ง | Identified clothing/personal goods; marketplace name alone is insufficient |
| บันเทิงและดิจิทัล (app legacy label: บันเทิง) | Games, cinema, streaming |
| การศึกษา | Courses, tuition, study books |
| ครอบครัวและสังคม | Verified gifts, donations, hosting |
| ค่าธรรมเนียมและดอกเบี้ย | Bank fees, interest and fines, not debt principal |
| อื่น ๆ | Verified expense whose purpose does not match a listed category; explain it |

The app preserves legacy category labels (including `ผ่อนชำระ/หนี้`, `ช้อปปิ้ง`, `บ้านและค่าน้ำไฟ`) to keep saved records valid. The spreadsheet uses a taxonomy of **14 true-expense categories**; debt payments and transfers are reported separately in the reconciliation view, not mass-reclassified here.

## Accounting and data safety

1. Keep **bank cash-out**, **confirmed goods/services spending**, **wallet top-ups / transfers**, and **unresolved records** as distinct reports. Bank cash-out and confirmed spending must not be summed into one KPI.
2. Under the existing app contract, a wallet top-up is recorded as an `expense` cash movement. Purchases with that wallet require reconciliation before claiming a separate aggregate expense. Never add receipt item totals to the paid transaction amount.
3. Debt repayments can contain principal, interest and fees. Do not claim the entire amount is a newly incurred cost without evidence.
4. Unknown recipient purpose or unknown product is **review required**, not automatically food, fuel, home goods or shopping.
5. Keep original transaction IDs, amount in integer satang, direction, date, receipt evidence and notes untouched unless a user explicitly confirms an edit. Do not auto-save uncertain OCR.
6. The app's current `Reports` aggregation is cash-out-based. Exact actual-spending-with-wallet reconciliation requires a separate linked-wallet record model and review; it is **not** implemented by these category additions.

## Release and verification

- Scope: `src/lib/finance.ts`, `src/lib/categorySuggestions.ts`, `src/lib/emailLedger.ts`, focused regression tests.
- Do not overlap or independently merge the read-only Reports UI draft PR #111 and overlapping PR #107.
- Required: targeted Vitest, full test/typecheck/build CI, Preview UX/WebKit for the category selector and evidence review, physical iPhone Safari/PWA, and reviewer approval before merge/Production.
- Rollback: revert the PR. No schema migration, backend/secret change or bulk database updates.
