# Product requirements — เงินวันนี้

## Purpose
Make daily income/expense entry take under 15 seconds while allowing users to understand where money goes at the end of each month.

## Primary user journey
Open app → Tap **เพิ่มรายการ** → Choose income/expense → Amount → Date/category/payment method/optional note → Save → See updated monthly total & recent activity.

## Information architecture

| View | Primary jobs |
|---|---|
| ภาพรวม (Dashboard) | Monthly net flow, income, spending, budget status, chart, category mix, recent transactions |
| รายการทั้งหมด (Transactions) | Find by text, type filter, edit, delete |
| รายงาน (Reports) | Monthly category amounts, savings ratio, expense averages, CSV export |
| ตั้งค่า (Settings) | Set budget, JSON backup/restore, CSV, privacy details |

## Core functional requirements (v0.1)
1. Persist valid income and expense entries across reloads with no network.
2. Support full create/edit/delete transaction lifecycle.
3. Keep values in integer satang to prevent floating-point summation errors.
4. All month filters use local calendar dates and THB formatting.
5. Never silently insert demo or actual financial data.
6. Show honest empty states without fake statistics.
7. Budget alert on monthly expenses > user-configured budget.
8. Export JSON with versioned schema and CSV with UTF-8 BOM.
9. Confirmation before destructive deletion or restore.
10. Mobile touch targets, semantic button labels, form validation, keyboard focus.

## UX details / edge cases
- Date rollover across December/January; budget uses full calendar month.
- Zero income: ratio shows — rather than division by zero.
- Future months permitted for planned transactions in v0.1 (all records are treated as entries); later distinguish planned vs completed.
- Credit card payments are classified by method but v0.1 does not compute outstanding balances.
- Offline is available after app shell assets are visited and cached; first install needs internet.
- Browser storage may be cleared; warn about backups.

## Not in MVP
Bank feed/OCR, authentication, cross-device sync, envelope transfers, bank reconciliations, multi-currency, recurring automatic posting, partner sharing, tax reports.

## Definition of done
`npm test`, `npm run build`, manual responsive viewport QA, create/edit/delete, export/import smoke check, Android/iOS install smoke check on actual devices before production release.
