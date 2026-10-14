# Money Tracker: Competitive UX Patterns Adaptation

Date: 2026-10-14. Scope: **Money Tracker** ("เงินวันนี้"), slip-first, Thai THB, private/local-first.

## UX decisions (inspired by patterns; no competitor artwork or screens copied)

| Pattern worth learning | Reference apps | Money Tracker adaptation |
| --- | --- | --- |
| Make common tasks immediately available | Monefy | A large **เพิ่มสลิปหรือใบเสร็จ** primary action, **กรอกรายการเอง** secondary action; both visible on desktop and mobile |
| Glanceable, trustworthy insights | Spendee | **วันนี้ใช้ไป** / **รับเงินวันนี้** snapshot and top three expense categories with proportional progress bars |
| Explain scan-and-save outcomes | Expensify, Smart Receipts | Correct **เลือกรูป → อ่าน OCR → บันทึกหรือรอตรวจ** sequence and separately count saved, duplicates, incomplete/pending, and OCR errors |
| Review transactions quickly | Money Manager | Transactions grouped by day, latest date/time first; search and filter reset; explicit empty state |
| Keep reporting optional | Wallet, YNAB | Preserve full Reports page and monthly budget; make home a small, useful overview, not a duplicate analytics dashboard |

## Information architecture

1. Home: large scan CTA → selected month → pending OCR review when needed → today snapshot → recent transactions → top 3 categories → reports link → accounting summary and budget. Today snapshot uses *today's date* independently of which month is selected.
2. Transactions: saved/pending slip/pending iPhone tabs; searchable, date-grouped saved transactions; clear filters when zero results.
3. Reports: existing 6-month cash-flow, category report, budget-related insight.
4. Settings: current integrations, budget, backups and privacy unchanged.

## Safety and correctness

- All calculations use existing integer satang fields, **not OCR text**.
- Today summary is not a bank balance. No pending draft counts toward totals until it is saved.
- Keep duplicate protection, auto-save confidence checks, local IndexedDB storage and review queues.
- Maintain the existing user's banking scope and don't integrate extra financial accounts.
- Mobile uses a vertical scan-first hierarchy; desktop retains a wider dashboard.

## Acceptance and validation

- Unit: daily income/expense satang totals, grouped ordering and relative date labels.
- Browser: 320 / 375 / 390 / 430 / 768 / 1280 widths, no horizontal overflow, axe WCAG scan, primary scan button opens, OCR steps, manual entry and transaction save.
- Browser: searching for a nonexistent merchant shows reset; saving a transaction shows a dated ledger section.
- Manual: iPhone Safari upload from Photos and camera, real K PLUS and store receipts, 20-slip queue, page visibility, VoiceOver, keyboard and older iPhone performance. Browser/CI checks **do not prove** real-image OCR accuracy.
