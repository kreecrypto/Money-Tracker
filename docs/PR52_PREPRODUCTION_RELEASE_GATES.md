# PR #52 — Pre-Production Release Gates

Reference: user-supplied Money Tracker / เงินวันนี้ four-screen mobile UI.
Branch: `improve/frontend-html-css-js-safari-20261016`
Target production domain (unchanged): `https://money-tracker-beta-teal.vercel.app`.

## Current automated evidence (2026-10-16)

- [x] Web App CI — unit tests, typecheck, Vite build.
- [x] Chromium UX/UI + axe audit — 320/375/390/430/768/1280px.
- [x] Safari Playwright WebKit visual smoke — 375/390/430px.
- [x] Report navigation actually changes the displayed panels (overview, categories, trends, budget).
- [x] Reports and Home have no duplicate floating upload button.
- [x] OCR upload card title/icon have dark, readable colors on the light-mint card.
- [x] OCR preview lifetime fixed: last processed image remains visible in the result view, then the object URL is revoked on a new batch or unmount; no persistent slip-image storage.
- [x] Thai fonts installed for Chromium screenshots.
- [x] New UI-specific CSS merged into a single end-of-cascade file, `reference-parity.css` (legacy styles remain separated).
- [x] Pending tabs on Transactions only appear when pending records exist or the user is viewing them; monthly financial summary is collapsible.

## Mandatory manual gates (NOT YET VERIFIED)

**Do not merge or deploy until all the checks below have explicit evidence.** Automated WebKit is not a physical iPhone.

| Gate | Exact exercise | Expected |
|---|---|---|
| Native Safari | Open preview on iPhone (normal tab) in portrait and landscape; check safe area, Thai font, toolbar, status bar, icons | No clipping/overflow, top/bottom actions reachable |
| iOS PWA | Add preview to Home Screen, cold-launch and switch apps, reopen | Same navigation, no stale layout or blocked sheet |
| Keyboard | Focus manual amount/search/owner-name fields while the iOS keyboard opens; dismiss keyboard | Fixed navigation does not cover inputs, modal remains scrollable |
| Valid K PLUS | Upload a privacy-safe **real** K PLUS slip with known date, time, recipient and amount | Amount/date/time/recipient/direction correct; exactly one Saved transaction without forced confirmation |
| Missing amount | Upload slip whose amount OCR cannot reliably read | Pending, never guess a value or silently save as 0 |
| Income vs expense | Test owned sender, owned receiver and unclear owner (configure Settings → name on slip first) | Sender=expense, receiver=income; ambiguous ownership=Pending |
| Wallet top-up | Upload supported top-up slip (e.g., TrueMoney via K PLUS) | Expense, not income |
| Duplicate | Re-upload same saved slip/image and check Transactions | Duplicate, no second saved row |
| Batch upload | Select multiple slips, including one duplicate and one incomplete | Per-image states shown, correct Saved/Pending totals, no duplicates |
| Retail receipt | Upload a supported 7-Eleven receipt with known totals | Correct payable amount and item/date handling as supported |
| Result preview | Wait until OCR completes, inspect the last slip image, close and re-open the scanner | Image remains visible until close; stale image is not shown in a new scan |
| Totals/reporting | Navigate Saved → Transactions → Reports, switch four report segments, refresh | Count/total match storage; each report segment shows the selected content |
| Settings / storage | Export backup before manual tests, verify restore and deletion behavior on a disposable test profile | No lost real-user financial data |
| Visual parity | Compare screenshots at 375/390/430 against user mockup by viewport and content state | Typography, spacing, colors and alignment reviewed/accepted, not just green CI |

## External deployment blocker

Vercel reports `build-rate-limit` for **both** Money Tracker and Money Tracker API preview contexts on this branch.
This is not a TypeScript build error. Avoid resubmitting more builds while rate-limited.
After the limit resets or account quotas are addressed, check that the latest preview
is built from the PR head SHA, and retest the preview before merging.

## Safe release sequence

1. Restore Vercel preview capability.
2. Validate preview SHA equals PR head, not an earlier READY deployment.
3. Run the iPhone, OCR, duplicate and accessibility acceptance checks above using redacted samples.
4. Compare final screenshots to the supplied reference.
5. Approve PR #52 only with evidence from steps 1–4.
6. Merge to `main`, wait for successful production deployment, confirm the unchanged
   `money-tracker-beta-teal.vercel.app` alias resolves to the new production SHA.
7. Smoke-test dashboard, scan, Transactions, Reports, PWA refresh, API sync, and backup.
8. Keep a rollback deployment available; do not alter the finance storage schema in this UI PR.

## Deferred technical debt (non-functional / later refactor)

The legacy global stylesheets `styles.css`, `mobile-first.css`, `daily-minimal.css`
and `fintech-ui.css` still rely on cascade overrides. Replacing all legacy selectors
at once is not part of this safe, visual-only PR. Consolidate into component-scoped CSS
through independent regression-tested changes rather than deleting styles blindly.
