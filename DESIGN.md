# Money Tracker — Design System

## Overview
**Creative North Star: Quiet Financial Clarity.** Money Tracker should feel like a finished utility on a phone: one primary action, clear real financial values, low-friction navigation, reassuring states and no unnecessary marketing copy. In Impeccable terms each operational screen is in **Operate** mode. Preserve the existing green fintech identity rather than introducing a new dashboard template. The target Email-first Home visual hierarchy is **monthly net → income/expense → actual Gmail connection/sync status or setup → Pending review → recent transactions → secondary slip/manual entry**. The currently deployed slip-first UI remains until the Gmail connection and state are implemented and tested. Use spacing to group information rather than nested cards.

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
- Keep all primary buttons at least 48px high. Maintain a predictable Home → Transactions → Reports → Settings journey. In the Email-first target, show one prominent *real* Gmail setup/status action when unlinked (or review action when linked); keep slip upload secondary.
- Test both reading sizes on 320, 375, 390 and 430px Safari/WebKit, including page reload persistence, 0 horizontal overflow, navigation hit sizes, and slip buttons. Test on a real iPhone before Production.
- The preference is in localStorage `ngoentoday-reading-size-v1` and is cleared when the user deliberately erases device data. Financial data and OCR logic are unchanged.

## Responsive Grid Contract (2026-10-18)
- Design is mobile first and non-decorative: **320–767px = 4 columns** (16px page margin, 12px gutter); **768–1199px = 8 columns** (24px margin, 16px gutter); **1200px+ = 12 columns** (32px margin, 24px gutter).
- The page header and body share one left/right content margin. Child surfaces do not add a separate page gutter. Use `minmax(0,1fr)` on every track and `min-width:0` on financial rows to avoid clipping signed amounts and Thai strings.
- Home (Email-first target): monthly summary, one truthful primary Gmail status/setup surface, Pending review and recent transactions each span the available page. Upload slip and manual add become secondary. Income / expense inside the hero split evenly across two halves.
- Transactions: search then filter chips stack on narrow phones; use 5/3 tracks on tablet and 8/4 tracks on desktop. Ledger rows retain flexible text + amount to preserve long account names.
- Reports: monthly metrics occupy 2+2 and net full width on phone, 4+4 and net full width on tablet, 4+4+4 on desktop. Supporting charts use 5/3 or 7/5 split only when wide enough.
- Upload: camera and gallery buttons each span half of the available scanner width; minimum 48px hit height, no giant flex buttons at 320px.
- Settings: one-column forms on phone and two balanced regions on wider views. Keep headings, anchors and full-width reading-size controls.
- QA contract: check `getComputedStyle(...).gridTemplateColumns` and overflow on 320, 375, 390, 430, 768 and 1280px, both normal and large-text modes; include OCR modal and report views. This layout contract does not change data, API or OCR logic.

## Elevation
Flat by default. Use thin green-tinted borders and white backgrounds instead of cards inside cards. Only the monthly summary, floating popover and modal may need restrained elevation. Do not add glowing accents, generic gradients, or decorative highlights that compromise readability. Existing brand green gradient is a deliberate exception, kept within AA contrast.

## Components
- **Topbar**: “เงินวันนี้” identity, accessible notifications and settings controls; 44×44px hit areas.
- **Monthly summary**: month chooser, monthly net, split income/expense in compact internal white surfaces; no fabricated trends.
- **Month chooser**: real months, clear selected state, keyboard close and focus restoration; must not overflow the visual viewport.
- **Primary email connection/status** (target): visible on Home with backend-grounded state, masked Gmail identity if actually authorized, actual last sync and actionable setup/reconnect. Do not present an Apps Script setup as one-tap Gmail OAuth; use a truthful setup-guidance action until OAuth exists.
- **Secondary upload**: keep the existing Home entry and camera/gallery choices accessible but below connection/review priorities.
- **Recent transactions**: one tappable row per saved entry, icon + counterparty/category + date + signed amount; truncate long titles but avoid clipping values.
- **Bottom navigation**: exactly four persistent destinations — ภาพรวม, รายการ, รายงาน, ตั้งค่า; no duplicate Home shortcuts.
- **Slip scanner and Pending**: truthful progress, duplicate and uncertain states; no false completed statuses; privacy/safety warnings remain readable.
- **Settings**: email connection/consent/sync status and disconnect controls are first-class; legacy Shortcut, LINE and build information remain progressively disclosed.
- **Modal and menu**: focus-visible rings, Escape where appropriate, accessible labels, safe-area awareness and reduced-motion fallback.
- **Responsive**: 320, 375, 390, 430, 768 and 1280px are QA baselines; iOS Safari must be explicitly checked.

## Do's and Don'ts
- **Do** use the existing app's components and visual language as the baseline.
- **Do** display actual balance semantics: monthly income minus expense is a monthly net, not necessarily a bank balance.
- **Do** keep upload/OCR available as a secondary fallback, while Gmail connection status and Pending actions take priority in the Email-first target UI.
- **Do** keep typography legible, touch controls comfortably sized and layouts tolerant of Thai names and long amounts.
- **Do** test browser rendering and GitHub CI before Production release.
- **Don't** invent account balances, banks, transactions, charts, accuracy rates or example data in production.
- **Don't** introduce generic SaaS layouts, nested cards, attention-grabbing badges or meaningless decorative gradients.
- **Don't** remove failure, retry, Pending or data-loss states to make UI look “minimal”.
- **Don't** merge an untested UI change or claim production is updated until its Vercel deployment is READY and the target domain is verified.

**Impeccable usage:** From project root, run `npx impeccable install` in your coding environment, then `/impeccable polish the Home screen`, `/impeccable audit the app`, and `npx impeccable detect src/`. This is a hand-curated compatible context, not an assertion that the official init/document commands were run.
