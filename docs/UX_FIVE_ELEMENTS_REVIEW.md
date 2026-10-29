# Money Tracker — Five Elements UX Review (2026-10-29)

Framework: Jesse James Garrett, **Strategy → Scope → Structure → Skeleton → Surface**.
This is a focused P1 UX improvement report on draft PR #96, not a new accounting product or an OCR rewrite.

## 1. Strategy — product objectives and user needs

**Observed code/product gap:** `PRODUCT.md` still described a briefing-first experience while Home actually puts the calendar before the monthly briefing.
**Decision:** Calendar-first: let users inspect recorded days, choose a day, find its underlying Saved entries, then inspect a monthly summary and Pending tasks.
**User success:** Users can answer “มีเงินเข้า–ออกวันที่ไหน?”, “วันนี้มีรายการอะไร?” and “มีอะไรค้างตรวจ?” without confusing book totals with their actual bank balance.
**Acceptance:** Calendar is the first Home content; its source is Saved records only; financial summaries still use integer satang and no invented balances.

## 2. Scope — functions and content requirements

**Keep:** K PLUS slip capture, multi-image auto-save only when validated, Pending review, duplicate detection, manual correction, month selection, date drill-down, existing reports.
**Improve:** Visible review count (local Pending + known iPhone Pending) in the existing bell, rather than an unexplained colored dot. Explain in Pending that unsaved entries are absent from both totals and calendar.
**Not in scope:** New integrations, notification backend, bank verification, OCR parser changes, financial data migration, additional Home primary CTAs.

## 3. Structure — interaction design and IA

Existing journey: Home calendar → select day → date-specific Transactions with dismissible date filter → whole month. Add **กลับไปวันนี้** for returning from a prior/future day or month directly; this changes both current month and selected date.
The notification bell retains existing navigation to the Pending review destination. If there are two different queues, separate tabs remain available from Transactions.

## 4. Skeleton — interface and information design

Calendar stays first below Header. Its legend explains that totals contain only Saved data; a contextual “กลับไปวันนี้” action appears when another date is selected.
Next: selected-day section with exact signed totals and up to four saved entries → monthly summary → accountant summary → one slip upload action → recent entries.
A numeric badge on the existing bell helps users recognize work to review without introducing a new menu.

## 5. Surface — visual and accessibility

Today uses an underline and subtle outline if not selected; Selected already uses a stronger fill and border. These states coexist and are not communicated by color alone.
For 320–359px, small calendar amounts continue to use income/expense indicators; full exact values remain in selected-day details and screen-reader labels. Buttons and reset targets preserve readable Thai, clear focus and ≥44px touch targets where existing controls allow.

## Verification and limitations

- Unit/integration checks: Home-first hierarchy, date drill-down, current-day reset availability, numeric review counter, Pending semantics, existing OCR/finance regressions.
- Browser: responsive UX & accessibility audit plus Safari/WebKit scripted tap sequence; verify today's date visually and behaviorally.
- Vercel Preview must match PR's exact latest SHA before claiming READY.
- **Blocker for Production:** physical iPhone Safari/PWA and real K PLUS sample validation are not replaced by CI. Draft PR #96 remains open and Production unchanged pending release sign-off.
