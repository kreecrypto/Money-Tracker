# Money Tracker — UX Content release gate (18 Oct 2026)

## Goal
Make the existing mobile-first financial record app read like a daily-use Thai app.
Scope: copy/semantics, preserved sender on income review drafts, search parity,
truthful feedback and reports. Do not change K PLUS OCR inference, transaction totals,
storage of original images, sync API, deduplication, or production domains.

## User acceptance scenarios
1. First launch: no sample transactions; prominent slip upload; owner name is helpful but optional.
2. K PLUS expense: uploaded image with complete evidence saves once; success explains that money is counted.
3. K PLUS income: sender is visible on Home, Transactions and edit/review; searchable by sender.
4. OCR amount incomplete: use a specific reason, no zero-value save; pending is excluded from financial totals.
5. Pending review: editing sender/recipient persists in the local structured draft; old drafts without sender remain valid.
6. Duplicate image: no second transaction; state reads "เคยบันทึกแล้ว".
7. Multi-image: saved, pending and failed totals are separately explained; pending requires review.
8. Wallet top-up: bank expense policy and anti-double-count messaging are unchanged.
9. Reports: no negative percentage labelled as "over income"; selected/historical month labels are accurate.
10. Settings: confirmation explains local deletion versus synced copies, with backup first.
11. UI alerts: destructive errors are not paired with a success checkmark; VoiceOver announcement uses alert for errors.
12. iPhone Safari: 320/375/390/430 px; keyboard, safe area, focus, paste/photo picker and modal dismissal.

## QA requirements before production
- TypeScript check, unit tests, build and existing UX/UI, WebKit and visual CI on the branch.
- Screenshot comparison with approved Home design-system reference.
- Physical iPhone Safari + installed PWA run with private real K PLUS slips:
  complete expense, incoming payment, unreadable amount, duplicate, mixed batch, TrueMoney top-up.
- Verify owner-name direction classification, pending/saved totals, local-only data warnings,
  restart/reload persistence and iPhone/cloud sync behavior.
- Review PR, deploy a Preview, inspect source SHA and Preview UX states.
- **Do not merge or deploy production until the iPhone evidence and CI gates pass.**

## Product language decisions
- Use "ผู้โอนเงิน" for income and "ผู้รับเงิน" for expense.
- Use "ต้องตรวจข้อมูล" for pending rather than implying a saved transaction.
- State explicitly whether a transaction is included in income/expense totals.
- Replace technical terms on primary screens; keep necessary technical setup terms in advanced settings.
