# Money Tracker — UX/UI Audit (10 October 2026)

**Project:** เงินวันนี้ / Money-Tracker
**Repo:** https://github.com/kreecrypto/Money-Tracker
**Deployment:** https://money-tracker-beta-teal.vercel.app/
**Source revision audited:** `e2bbc691` (application product code remains v0.2.0)
**Scope:** Dashboard, Transactions CRUD, Reports, Settings, Add Transaction modal, Slip OCR, responsive layout, accessibility, data safety, public access
**Audit type:** Source/UI implementation inspection + production HTTP check + Chromium browser QA. **Not** a Figma-to-production pixel parity review.

## Evidence and verification levels

- **Verified — Source:** `src/App.tsx`, `src/SlipScanner.tsx`, `src/styles.css`, `src/lib/slip.ts`, `src/lib/storage.ts`, `public/sw.js`, `README.md`.
- **Verified — Deploy:** Vercel served production HTML with HTTP 200 through authenticated Vercel fetch. Project framework Vite, build READY. Public anonymous browsing has **not** been proven: Deployment Protection reports SSO enabled for some domains.
- **Verified — Browser:** GitHub Actions Playwright Chromium run [38014103488](https://github.com/kreecrypto/Money-Tracker/actions/runs/38014103488) **PASS**. 24 screen snapshots across 320px/390px/768px/1280px; [25-file screenshot and JSON evidence artifact](https://github.com/kreecrypto/Money-Tracker/actions/runs/38014103488/artifacts/11655158441) (requires GitHub access; limited retention). Four isolated create-and-save smoke tests succeeded without page errors. One 320px Settings pointer obstruction was detected and programmatically bypassed for coverage, NOT fixed.
- **Not yet verified:** Real-device iPhone Safari/Android Chrome touch and camera behavior, assistive technology/VoiceOver, bank slip image accuracy, data persistence following PWA upgrades, public anonymous access.

## Executive summary

The app has a clear four-item IA, recognizable income/expense visual language, a strong primary Add action, explicit OCR review before saving, and transparent local-only data storage. However, inaccurate OCR classification, mobile navigation clickability, visual readability, modal keyboard/focus management, duplicate entry control, and data-loss prevention all need work before broader release.

### P0 — critical / release blocker

| ID | Area | Evidence | User impact | Fix / acceptance criteria |
|---|---|---|---|---|
| P0-01 | Slip OCR → transaction type | `EntryModal` defaults to `expense`; `applySlip` inserts amount/date/note and bank method but does not enforce selecting whether this is money in or out | An incoming bank transfer can be unintentionally recorded as an expense, distorting totals | OCR review must require an explicit **เงินเข้า / เงินออก** choice before Apply/Save. Never infer direction solely from account slip layout. Test incoming and outgoing slips for each flow. |
| P0-02 | Small-screen navigation | Chromium 320px: Reports had **30px horizontal overflow** and Settings nav was pushed outside the viewport; pointer click was intercepted by `main.main-content` (confirmed in run 38014103488) | User cannot reliably navigate all four tabs on a narrow viewport | Remove horizontal overflow and ensure the fixed bottom bar never expands beyond the viewport. At 320/375/390/430px every nav action must be clickable by a real pointer, without forced DOM click or horizontal scrolling. |
| P0-03 (gate) | Production access | Vercel `ssoProtection.enabled: true` for `all_except_custom_domains`; authenticated fetch works, public anonymous reachability unverified | External real users may see a login/authorization page | Run a private-session anonymous URL test before labeling the app publicly released; keep protection unless public access is explicitly intended and approved. **Status: BLOCKED / unverified**, not a demonstrated outage. |

### P1 — high priority

| ID | Area | Finding | UX recommendation / acceptance |
|---|---|---|---|
| P1-01 | Typography and contrast | Several texts use 9–12px, with gray text such as `#9aa9ad` on white (~2.43:1) and `#a6afb4` (~2.23:1), below WCAG AA 4.5:1 for regular-size text | Adopt readable Thai text scale (body 14–16px, annotations 12–14px) and verified AA text tokens. Don't depend on color alone for income/expense. |
| P1-02 | Touch targets | Transaction action icons are 30×30px, on narrow mobile CSS they become 24×25px; OCR close button is 30×30px | Make interactive hit areas around 44×44px, with at least 8px separation for destructive actions. Test with fingers on small phones. |
| P1-03 | Modal and OCR review flow | OCR is inside an already scrollable Add Transaction modal; scanner adds image, progress, OCR text, and Apply above the form. The amount input receives automatic focus even when scanning | Prefer a two-mode capture flow (manual/scan), then a full-width OCR review step, followed by editable transaction confirmation. Avoid opening the keyboard during scanning; place action CTA within reach. |
| P1-04 | Duplicate financial entries | `saveTransaction` accepts fresh UUIDs and no check on duplicate slip content/amount/date/recipient | Before Save, warn when same or nearly identical amount/date/note/method already exists; allow explicit override. Do not block legitimate repeated payments. |
| P1-05 | Reports period mismatch | Dashboard `history` always uses `lastMonths(6)` relative to today; selected month picker controls other totals | Graph must match selected time range or clearly display 'ย้อนหลัง 6 เดือนถึงปัจจุบัน' separately from the selected-month summary. |
| P1-06 | Data retention | Financial data is IndexedDB-only; backups must be exported manually and importing a backup replaces everything after a native browser confirm | Add persistent first-use and post-N-transactions backup reminder; offer a backup download before destructive import. Make 'แทนที่ข้อมูลทั้งหมด' visually explicit with a preview of counts. |
| P1-07 | Keyboard and screen-reader modal access | Modal has `role=dialog` and Escape-to-close but no visible focus trap/return focus logic; no backdrop scroll lock evident | Trap focus within modal, focus title/first useful field, restore focus on close, prevent background scroll and clarify async save disabled states. |
| P1-08 | iPhone scan input support | Input accepts only JPEG/PNG/WebP; HEIC/HEIF from iOS may be rejected. OCR model download may take time, progress can stay at zero until recognition | Add HEIC conversion or explicit photo-compression path; show Downloading OCR → Reading image → Review status and an actionable offline/network error. |
| P1-09 | Collapsed tablet navigation accessibility | At 768px the sidebar hides its text labels without supplying aria-label to the four icon-only navigation buttons; axe-core reports four `button-name` failures | Add aria-label per nav action, tooltip for sighted pointer users, and visible keyboard focus. Ensure the current page state remains announced. |
| P1-10 | Form control labeling | axe-core reports one `label` failure in Settings (repeated while Settings remains underneath the modal); the hidden JSON import file input has no accessible name | Add a stable id + associated label or aria-label; confirm no unlabeled controls in the full audit. |

### P2 — usability refinements

| ID | Finding | Recommendation |
|---|---|---|
| P2-01 | Product copy mixes Thai with English ('WORKSPACE', 'FINANCIAL OVERVIEW', 'LOCAL FIRST') | Use a consistent Thai-first language system and short financial labels; keep jargon for an optional detail view. |
| P2-02 | Sidebar says version 0.1.0, Settings says v0.2.0; README's setup/roadmap sections still describe uncreated repo and no deployment | Derive version from package metadata; synchronize instructions to deployed state. |
| P2-03 | 'กระแสเงินสุทธิ' can be mistaken for available bank balance; 'อัตราเก็บเงิน' can be negative | Add 'รายรับ - รายจ่ายที่บันทึก' under the headline. Show negative ratio as 'ใช้มากกว่ารายรับ' and distinguish untracked cash/bank balances. |
| P2-04 | Search and filters work only within the selected month and type; CSV export wording is broader than current visual filter | Add a period shortcut and category/method filters or explicitly communicate month scope. |
| P2-05 | Destructive interactions rely on native `window.confirm`, unlike the designed dialog | Create consistent confirmation and result states for deletion/restore with clear primary/secondary CTA ordering. |


## Browser QA measurements — completed

**GitHub Actions:** [Run 38014103488 — PASS](https://github.com/kreecrypto/Money-Tracker/actions/runs/38014103488). This is a **successful audit execution**, not a claim that the audited UI passes accessibility. Screenshots and machine-readable results: [25 artifacts](https://github.com/kreecrypto/Money-Tracker/actions/runs/38014103488/artifacts/11655158441).

| Metric | Result | Interpretation |
|---|---|---|
| Viewports | 320×700, 390×844, 768×1024, 1280×800 | Emulated Chromium only; not real device coverage |
| Pages/screens | 24 snapshots (Dashboard, Transactions, Reports, Settings, Add, OCR × 4) | All target screen states captured |
| Basic save smoke | 4/4 success; no JavaScript page errors | Local IndexedDB save flow verified in each emulated viewport |
| axe-core `color-contrast` | Found in **24/24** screen snapshots | Repeated contrast failures in nearly every component; counts are *screen-level*, not distinct bugs |
| axe-core `button-name` | Found in **6/24** snapshots, all at 768px | Collapsed icon-only sidebar loses four accessible names |
| axe-core `label` | Found in **12/24** snapshots | One missing input label persists on Settings/underlying overlay |
| Mobile 320px | Reports 30px horizontal overflow, Settings 2px | One reproducible blocked Settings tab during Reports; the automation used DOM click solely to continue |
| Mobile 390px | No horizontal overflow recorded in six target snapshots | This does not prove device Safari is issue-free |
| OCR panel at 320px | 13 of 18 visible interactive targets below 44px in width or height | Touch-target check is a UX heuristic, not automatic WCAG-failure proof |
| OCR modal at 320px | 630px visible height; content height 1156px; Save CTA below the viewport | Scrolling is required to reach the main action after scanning |

**Screen-level automated audit status: FAIL** until accessibility, narrow-screen navigation, and financial-type confirmation are corrected. The GitHub Actions workflow itself passed and uploaded evidence.

## Recommended UX direction

### Home / Today
Primary area: 'รายรับเดือนนี้', 'รายจ่ายเดือนนี้', 'คงเหลือสุทธิจากรายการที่บันทึก' and a single prominent 'เพิ่มรายการ'. Display a 7-day activity preview before advanced charts on a small screen. Keep monthly budget progress visible but secondary.

### Add Transaction
`Tap Add → Choose [บันทึกเอง | สแกนสลิป] → Explicit money-in/money-out → Editable amount/date/category/method/note → Review → Save → Success`. For OCR, show original slip beside highlighted extracted fields on desktop, and image thumbnail collapsible above fields on mobile. Use field-level 'ตรวจสอบ' statuses instead of assuming extracted values are correct.

### Transactions
Use one tappable transaction row to open details; move Edit and Delete into detail action menu or accessible target clusters rather than two tiny side-by-side buttons. Prioritize date, description, signed amount; supporting metadata should be legible.

### Reports
State the period for **every** chart, table, and summary. Distinguish net cash flow from bank balance. Filter by month/period consistently.

### Settings and Backups
Use a 'ข้อมูลอยู่ในเครื่องนี้' status with explicit manual backup CTA, last backup indicator (if measurable locally), and a guarded Restore flow. Preserve privacy: no automatic financial photo upload.

## QA acceptance matrix

| Test | Gate |
|---|---|
| 320, 375, 390, 430px mobile layout | No horizontal overflow, all tabs tappable, modal CTAs reachable without blocked pointer |
| 768, 1024, 1280px | Consistent navigation, grids, focused controls and readable chart labels |
| Accessible name/focus | Keyboard-only task completion, focus trapped in dialog, actionable messages announced |
| WCAG AA colors | Normal text ≥4.5:1, large text ≥3:1, informational visual boundaries/controls assessed |
| OCR — outgoing and incoming | Type explicitly verified, OCR data never silently saved, user can correct every value |
| OCR — exceptions | Empty result, no amount, poor image, >10MB, network down, unsupported HEIC, duplicate slip |
| Data safety | Create/edit/delete survives reload; Restore warns and offers backup; offline/PWA restart tested |
| Public availability | Verify deployment anonymously in a private/incognito session if public release is intended |
| Real devices | iPhone Safari and Android Chrome, camera/gallery/keyboard/scroll, VoiceOver/TalkBack |

## Execution order (implementation backlog)

- **Batch A — P0 safety & access:** OCR direction confirmation, mobile nav hit-test, verify deployment access. No design-system overhaul.
- **Batch B — accessibility and core flows:** typography/contrast tokens, touch targets, focus trap, OCR UX simplification.
- **Batch C — trust and analytics:** duplicate slip warning, backup UX, report timeframe integrity, copy consistency.

## References

- Application: https://github.com/kreecrypto/Money-Tracker/blob/main/src/App.tsx
- OCR UI: https://github.com/kreecrypto/Money-Tracker/blob/main/src/SlipScanner.tsx
- Layout/CSS: https://github.com/kreecrypto/Money-Tracker/blob/main/src/styles.css
- Data storage: https://github.com/kreecrypto/Money-Tracker/blob/main/src/lib/storage.ts
- Browser audit script: https://github.com/kreecrypto/Money-Tracker/blob/main/scripts/ux-audit.mjs
- GitHub Actions UX/UI Audit: https://github.com/kreecrypto/Money-Tracker/actions/workflows/ux-audit.yml

**Note:** This report documents existing issues and proposed acceptance criteria; the application's user-facing UI has not been modified by the audit.
