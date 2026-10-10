# Money Tracker — Mobile-first Minimal Design Specification (v0.4.0)

## Principles
- **Mobile-first:** design from 320px. The primary use case is making a daily entry with one hand.
- **Content before decoration:** net recorded cash flow, primary actions and latest entries above charts.
- **Minimal:** off-white canvas, white flat surfaces, understated dividers, one forest-green accent. No colorful decorative illustrations, gradients or unnecessary shadows on the balance card.
- **Safety:** never conflate net cash flow with actual bank balance. OCR is only prefill; users still verify direction, amount, date, category.
- **Accessible:** readable 12–16px Thai labels, 44px+ touch targets and WCAG AA contrast, 4 primary navigation destinations.

## Home order, mobile (320–660px)
1. Screen title + today's date
2. Month selector
3. **Net cash flow** (money recorded) + two read-only income/expense summaries
4. Two quick actions **เพิ่มรายการ** and **สแกนสลิป**
5. Recent transactions (view all, compact single overflow menu on rows)
6. Monthly budget and alerts
7. Six-month trend and category detail (secondary)
8. Bottom navigation. Floating Add button is hidden on Home because the primary action is already visible there.

The DOM uses the existing home components wrapped in `.home-dashboard`; mobile source-order presentation is adjusted using CSS flex and ordering. Desktop enhancements use `@media (min-width:661px)` and retain the familiar two-column analytic grid.

## Transaction capture
- Add: **เพิ่มรายการ** → default manual entry → select money in/out → amount/date/category/method/note → Save.
- OCR shortcut: **สแกนสลิป** → camera/gallery → progress → Apply recognized values → explicit money in/out choice → review form → Save.
- Uncertain values stay blank. Duplicate-like transactions prompt deliberate confirmation.
- OCR image is not persisted and is not sent to an app backend.

## Visual tokens
- Canvas: `#f7f9f7`
- Surface: `#fff`
- Primary text: `#1b2e29`
- Secondary text: `#536760`
- Accent: `#166a55`
- Accent tint: `#eaf4ef`
- Hairline divider: `#e5ece8`
- Radius: 12–18px; no elevated card shadows by default.

## Responsive acceptance
| Viewport | Required |
|---|---|
| 320px | no horizontal overflow; quick actions fit two columns; tappable nav and modal |
| 375px | hierarchy and OCR shortcut; card totals legible |
| 390px | iPhone-size main journey |
| 430px | large phone; comfortable action spacing |
| 768px | collapsed sidebar with names and navigation functioning |
| 1280px | desktop analytic grid adapts without functionality loss |

The GitHub **UX/UI Audit** workflow runs Chromium + axe-core at all sizes, captures screenshots, tests adding a transaction, restoring a backup safely, and tests the OCR shortcut. It fails when it detects horizontal overflow, click interception, reported automated WCAG violations, or key journey regressions.

## Known limitations
- This is an emulated Chromium audit, not physical iOS/Android user testing.
- The browser app still keeps records on-device via IndexedDB, without cloud sync.
- OCR accuracy and iPhone HEIC support require real-device bank-slip QA.
- The original `src/styles.css` is retained for desktop/backwards compatibility, and `src/mobile-first.css` layers the new mobile baseline above it. Future consolidation should remove redundant desktop-first legacy rules only after visual regression evidence.
