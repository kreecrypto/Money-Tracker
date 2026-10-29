# Money Tracker — Design System

## Overview
**Creative North Star: Quiet Financial Clarity.** Money Tracker should feel like a finished utility on a phone: one primary action, clear real financial values, low-friction navigation, reassuring states and no unnecessary marketing copy. In Impeccable terms each operational screen is in **Operate** mode. Preserve the existing green fintech identity rather than introducing a new dashboard template. The Home visual hierarchy is **calendar → selected-day transactions and totals → monthly net → accounting secretary briefing and next action → upload supporting evidence → recent transactions**. The calendar is the first actionable financial view directly below the Home header. The Reports screen leads with accounting review and classified cash movements before secondary charts and budget. This is a reporting experience rather than a form-first ledger. Use spacing to group information rather than nested cards.

## Colors
Use CSS tokens and the current palette as authoritative; the source has older color variants that should be progressively consolidated, not treated as new colors to invent.

| Role | Color | Usage |
| --- | --- | --- |
| Primary dark green | `#0c6040` | Home financial summary |
| Primary green | `#126e49` | Summary, important actions |
| Green highlight | `#187752` | Gradient endpoint with legible white type |
| Primary CTA | `#08783f` | Upload slip |
| Ink | `#101f1b` | Primary text |
| Muted ink | `#586a60` | Secondary labels on white |
| Canvas | `#f7faf8` | Background outside Home's white surfaces |
| Stroke | `#e5efeb` | Borders and separators |
| Soft mint | `#ebf8f0` | Subtle statuses |
| Income | `#0b8e4c` | Incoming amount, with explicit + sign |
| Expense | `#c8334e` | Outgoing amount, with explicit − sign |

White text belongs only on sufficiently dark green. Secondary copy must maintain WCAG AA contrast; do not mute values needed to take action. Positive/negative money uses both signs and colors, never color alone.

## Typography
- Thai UI first: rely on the installed Thai-capable platform fallback stack while planning a measured Thai typography consolidation; the UI now prefers `Noto Sans Thai` with Thai-capable OS fallbacks; web-font loading can be evaluated separately for performance.
- Money uses tabular numerals; keep signs, currency symbol and amount together when possible, but allow wrapping for unusually long values on 320px screens.
- Home monthly amount: `clamp(26px, 7.1vw, 33px)`; main recent amounts: 14px; recent descriptions: 14px; metadata: 12px; upload CTA: 14px.
- Body reading size should generally be at least 13–14px; avoid 9–11px for important financial information.
- Prefer clear Thai action labels (e.g. “อัปโหลดสลิป”, “ดูทั้งหมด”, “รอตรวจ”) over mixed English metadata. Do not use uppercase or overly spaced lettering for Thai.

## Universal Minimal Accessibility (2026-10-18)
- Default text is readable without reducing information: 14px body and 12px only for metadata. Prefer 16px on form fields and longer descriptions. Keep financial amounts prominent and use +/− signs in addition to color.
- Settings offers a per-device **ขนาดปกติ / ตัวอักษรใหญ่** toggle. The large setting increases important supporting text to 14–16px, section headers to 19px, and preserves the four-tab navigation. Never depend on color or icons alone.
- Keep all primary buttons at least 48px high. Maintain a predictable Home → Transactions → Reports → Settings journey and a single prominent upload action.
- Test both reading sizes on 320, 375, 390 and 430px Safari/WebKit, including page reload persistence, 0 horizontal overflow, navigation hit sizes, and slip buttons. Test on a real iPhone before Production.
- The preference is in localStorage `ngoentoday-reading-size-v1` and is cleared when the user deliberately erases device data. Financial data and OCR logic are unchanged.

## Responsive Grid Contract (2026-10-18)
- Design is mobile first and non-decorative: **320–767px = 4 columns** (16px page margin, 12px gutter); **768–1199px = 8 columns** (24px margin, 16px gutter); **1200px+ = 12 columns** (32px margin, 24px gutter).
- The page header and body share one left/right content margin. Child surfaces do not add a separate page gutter. Use `minmax(0,1fr)` on every track and `min-width:0` on financial rows to avoid clipping signed amounts and Thai strings.
- Home: monthly summary, one primary slip CTA and recent transactions each span the available page; income / expense inside the hero split evenly across two halves.
- Transactions: search then filter chips stack on narrow phones; use 5/3 tracks on tablet and 8/4 tracks on desktop. Ledger rows retain flexible text + amount to preserve long account names.
- Reports: monthly metrics occupy 2+2 and net full width on phone, 4+4 and net full width on tablet, 4+4+4 on desktop. Supporting charts use 5/3 or 7/5 split only when wide enough.
- Upload: camera and gallery buttons each span half of the available scanner width; minimum 48px hit height, no giant flex buttons at 320px.
- Settings: one-column forms on phone and two balanced regions on wider views. Keep headings, anchors and full-width reading-size controls.
- QA contract: check `getComputedStyle(...).gridTemplateColumns` and overflow on 320, 375, 390, 430, 768 and 1280px, both normal and large-text modes; include OCR modal and report views. This layout contract does not change data, API or OCR logic.

## Elevation
Flat by default. Use thin green-tinted borders and white backgrounds instead of cards inside cards. Only the monthly summary, floating popover and modal may need restrained elevation. Do not add glowing accents, generic gradients, or decorative highlights that compromise readability. Existing brand green gradient is a deliberate exception, kept within AA contrast.

## Components
- **Topbar**: “เงินวันนี้” identity, accessible notifications and settings controls; 44×44px hit areas.
- **Calendar-first Home**: show the current selected month and tappable days first, then the selected day's saved transactions and signed income/expense totals; changing month updates the calendar and monthly context together.
- **Monthly summary**: month chooser, monthly net, split income/expense in compact internal white surfaces after the calendar detail; no fabricated trends.
- **Month chooser**: real months, clear selected state, keyboard close and focus restoration; must not overflow the visual viewport.
- **Accounting secretary**: display a truthful daily briefing, concise question-driven answers and any Pending next steps before the upload control. No AI-generated claims or artificial balances.
- **Detailed accountant review**: separate recorded cash out into debt, wallet top-ups, unknown-purpose and classified spending; exact bucket totals must equal outflow. Drill down to the same transactions, never claim certified expenses.
- **Primary upload**: remains visible on Home with one verb, but is secondary to the read-only report; use secondary text only to distinguish camera/gallery choices.
- **Recent transactions**: one tappable row per saved entry, icon + counterparty/category + date + signed amount; truncate long titles but avoid clipping values.
- **Bottom navigation**: exactly four persistent destinations — ภาพรวม, รายการ, รายงาน, ตั้งค่า; no duplicate Home shortcuts.
- **Slip scanner and Pending**: truthful progress, duplicate and uncertain states; no false completed statuses; privacy/safety warnings remain readable.
- **Settings**: advanced Shortcut, LINE and build information progressively disclosed, not mixed with daily options.
- **Modal and menu**: focus-visible rings, Escape where appropriate, accessible labels, safe-area awareness and reduced-motion fallback.
- **Responsive**: 320, 375, 390, 430, 768 and 1280px are QA baselines; iOS Safari must be explicitly checked.

## Do's and Don'ts
- **Do** use the existing app's components and visual language as the baseline.
- **Do** display actual balance semantics: monthly income minus expense is a monthly net, not necessarily a bank balance.
- **Do** keep upload/OCR visible and status messaging concise.
- **Do** keep typography legible, touch controls comfortably sized and layouts tolerant of Thai names and long amounts.
- **Do** test browser rendering and GitHub CI before Production release.
- **Don't** invent account balances, banks, transactions, charts, accuracy rates or example data in production.
- **Don't** introduce generic SaaS layouts, nested cards, attention-grabbing badges or meaningless decorative gradients.
- **Don't** remove failure, retry, Pending or data-loss states to make UI look “minimal”.
- **Don't** merge an untested UI change or claim production is updated until its Vercel deployment is READY and the target domain is verified.

**Impeccable usage:** From project root, run `npx impeccable install` in your coding environment, then `/impeccable polish the Home screen`, `/impeccable audit the app`, and `npx impeccable detect src/`. This is a hand-curated compatible context, not an assertion that the official init/document commands were run.


## Thai UX Writing (Calendar-first, October 2026)

- **Home-first language:** Calendar = `ปฏิทินรายรับ–รายจ่าย`; the selected day shows `รายการวันที่ ...` and the saved daily totals. A date without saved entries says `ยังไม่มีรายการที่บันทึกในวันที่เลือก`. Calendar empty days must not imply the user spent zero in the real world.
- **Period accuracy:** For user-selected historic months say `เดือนที่เลือก`, never `เดือนนี้`. The Home day-detail action goes to the **monthly** transaction list, so its label is `ดูรายการเดือนที่เลือก`; do not imply a date-filtered destination.
- **Transaction evidence:** Prefer `รายการล่าสุด` over bureaucratic labels; incoming slips may display the payer/sender, and search hints mention sender and recipient. All sums are records in the app, not actual bank balances.
- **OCR status:** `บันทึกแล้ว` is included in recorded totals; `รายการซ้ำ` adds nothing new; `รอตรวจ` is not included; failed images may need retry. Do not turn uncertainty into success language. Preserve wallet top-up as bank outflow and warn against double counting.
- **Voice:** Concise, neutral, actionable Thai. Show the next step in an error or empty state, but never promise a filter, data persistence, bank verification, or automatic accounting action that has not happened. Keep financial interpretation distinct from display wording.


## Calendar-first actionable UX (P1)

- Day detail shows at most four saved records, then a clear 'ดูทั้งหมด N รายการ' action leading to a date-filtered Transactions view (same selected month), never an unrelated whole-month list.
- Transactions displays the active date explicitly with 'เฉพาะวันที่ ...' and an accessible 'ดูทั้งเดือน' reset; switching to another top-level Transactions tab, accountant group, or a different month clears the date constraint. Pending is never included in recorded totals.
- At widths below 360px, colored indicator bars replace clipped 9px calendar numbers; full amounts remain in each calendar button's screen-reader name and in the selected-day summary. At larger widths compact values are at least 11px and use ellipsis.
- Verify date scoping, other-day exclusion, reset, 320–430px + large font, and unaffected Upload/Pending/duplicate behavior before release.


## The Five Elements of UX — calendar-first product contract (2026-10-29)

- **Strategy — user needs and product goals:** On opening the app, the first job is understanding when recorded money moved, what remains incomplete, and what action is available. Never imply recorded totals equal the bank balance or real spending not yet captured.
- **Scope — only necessary capabilities and content:** Keep one primary slip upload pathway, selected-day details, month summary and a single consolidated review destination. Do not add duplicate Home shortcuts or invent data. Pending slips are excluded from both the calendar and recorded totals.
- **Structure — interaction architecture:** Home calendar → select day → exact-day Transactions → clear date filter → whole-month Transactions. The same month context must follow navigation. An explicit 'กลับไปวันนี้' returns from other days or months without retracing arrow taps; the notification bell leads to existing review tabs.
- **Skeleton — information/navigation design:** Calendar first; selected-day numbers and list next; month financial totals, accounting summary, upload and recent activity below. A visible numeric review counter tells the user there are unfinished tasks; the calendar footer explains Saved-only data.
- **Surface — legibility and sensory design:** Distinguish Today (underlined number) from Selected (filled, outlined state), preserve +/- signed income and expense, show complete amounts in details and accessibility names, keep minimum tap targets and iOS safe areas. Do not use color as the only indicator.

Acceptance: in Safari/WebKit and Chromium on 320/375/390/430px, the date controls do not overflow; today and selected day are individually distinguishable, the reset action returns both month and selected day, the review counter is accurate, and Pending never appears as a Saved calendar transaction. Automated results are not physical-device proof.
