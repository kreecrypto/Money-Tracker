# Money Tracker — Design System

## Overview
**Creative North Star: Quiet Financial Clarity.** Money Tracker should feel like a finished utility on a phone: one primary action, clear real financial values, low-friction navigation, reassuring states and no unnecessary marketing copy. In Impeccable terms each operational screen is in **Operate** mode. Preserve the existing green fintech identity rather than introducing a new dashboard template. The Home visual hierarchy is **monthly net → income/expense → upload slip → recent transactions**. Use spacing to group information rather than nested cards.

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
- Thai UI first: rely on the installed Thai-capable platform fallback stack while planning a measured Thai typography consolidation; the existing code currently references `Inter`, `Noto Sans Thai` and OS fallbacks.
- Money uses tabular numerals; keep signs, currency symbol and amount together when possible, but allow wrapping for unusually long values on 320px screens.
- Home monthly amount: `clamp(26px, 7.1vw, 33px)`; main recent amounts: 14px; recent descriptions: 14px; metadata: 12px; upload CTA: 14px.
- Body reading size should generally be at least 13–14px; avoid 9–11px for important financial information.
- Prefer clear Thai action labels (e.g. “อัปโหลดสลิป”, “ดูทั้งหมด”, “รอตรวจ”) over mixed English metadata. Do not use uppercase or overly spaced lettering for Thai.

## Elevation
Flat by default. Use thin green-tinted borders and white backgrounds instead of cards inside cards. Only the monthly summary, floating popover and modal may need restrained elevation. Do not add glowing accents, generic gradients, or decorative highlights that compromise readability. Existing brand green gradient is a deliberate exception, kept within AA contrast.

## Components
- **Topbar**: “เงินวันนี้” identity, accessible notifications and settings controls; 44×44px hit areas.
- **Monthly summary**: month chooser, monthly net, split income/expense in compact internal white surfaces; no fabricated trends.
- **Month chooser**: real months, clear selected state, keyboard close and focus restoration; must not overflow the visual viewport.
- **Primary upload**: visible on Home with one verb; use secondary text only to distinguish camera/gallery choices.
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
