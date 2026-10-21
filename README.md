# เงินวันนี้ · Daily Money Tracker

Mobile-first, Thai-language, offline-first **daily income and expense tracker** (slip-first UI, October 2026). Uses a responsive React + TypeScript + Vite frontend and IndexedDB for local data storage.

## ✨ Features

- Add, edit, and delete income/expense transactions, including notes, date, category, and payment method.
- Monthly dashboard with net cash flow, monthly totals, category breakdown, and 6-month cash-flow chart.
- Monthly spending budget, overspending alert, search, and transaction type filters.
- Reports and category summaries, JSON backup/restore, and Excel-friendly UTF-8 CSV export.
- Installable Progressive Web App (PWA); offline usage after the first load.
- Financial amounts stored in **integer satang**, dates stored as **local calendar dates**.
- **Slip-first batch entry**: Choose up to **20 images in one Photos selection** (each JPG, PNG or WebP, max 10 MB), including K PLUS slips, 7-Eleven / 7Delivery receipts or Paotang G-Wallet transaction images. The app processes them sequentially on-device with a single OCR worker, saves each independently, and shows per-file results. Uploading one photo or taking a new photo still works. Multiple complete images are saved immediately without individual Review dialogs; duplicate, ambiguous and invalid files are skipped without stopping the batch. From the main action (JPG, PNG, WebP, max 10 MB), or capture a new photo. Client-side Tesseract.js attempts to extract **date, local time, amount and recipient name**. K PLUS bill-payment layouts are parsed from the masked sender account and biller block where an explicit payee label is absent. 7-Eleven receipts use the actual payment/tender line rather than individual item prices, and Paotang receipts use **จำนวนเงินที่ชำระ** after benefits/subsidies, not the gross goods value. The app also detects **income versus expense** when the receipt explicitly says that money was received, paid, or transferred out; it automatically saves an income or expense once the direction, amount, date, time and recipient are all clearly extracted. **No Review screen or second confirmation is required for a complete slip.** Generic transfers with unclear direction, missing/conflicting fields and duplicate-like slips are not auto-saved; the app explains why and allows retry or manual entry. Manual entry and editing saved items are still supported.
- Manual entry and in-app photo OCR remain local-first. Optional iPhone Shortcut Text Sync uses the dedicated authenticated API and Supabase to store **parsed transaction fields only**; no raw OCR text or images are stored. No direct bank account access.


Receipt Intelligence adds optional transaction.receipt metadata while keeping older IndexedDB and JSON backups valid. For supported receipts it stores receiptId, items[], subtotalSatang, discountSatang, subsidySatang, feeSatang, paidSatang and itemsComplete; the transaction amount remains the actual paid amount. Transactions can expand to show itemization and CSV exports include detail columns. Tesseract word coordinates are used to recover line item price alignment, but OCR is not guaranteed accurate and real-device tests on iPhone Safari remain necessary. No receipt images are uploaded or retained.

## Batch upload workflow

1. Tap **อัปโหลดสลิป** → **เลือกภาพสลิป**, select multiple photos in the iPhone Photos picker, then confirm selection. The file input uses the browser's native `multiple` attribute.
2. Money Tracker reads the images **one at a time** using one Thai/English OCR worker and immediately writes each valid transaction to IndexedDB. Previously saved images are skipped using the existing transaction duplicate heuristic.
3. During processing, a counter shows the current photo and saved/duplicate/failed totals. At completion, an itemized result shows errors with reasons; successful photos are already saved. When all photos save successfully, the dialog closes automatically.
4. A batch is capped at **20 images** to bound device memory and UI time. Extra selections are reported as skipped, not silently processed. Each photo must be JPG, PNG or WebP and at most 10 MB. Unsupported HEIC/HEIF files should be converted before uploading.

Batch OCR never uploads images to the server, stores thumbnails or creates partial transactions from invalid OCR. Only confirmed-by-validation structured fields are persisted. Browser-based automated tests assert the multi-select control at six widths; actual iPhone Photos batch selection should still be verified on-device.

## Slip OCR privacy and limitations

- Image OCR runs inside the browser using Tesseract.js (Thai + English). On the **first scan**, the OCR engine and language files must be downloaded from their configured external CDNs; without those assets the scan does not work offline. The selected image and raw OCR text are only held in memory during scanning, and are **not uploaded to our server** or saved in IndexedDB.
- OCR results are estimates, not bank-verified transaction records. Account numbers, transfer references, and fee/balance lines must not be treated as the payment amount. **Complete, clearly classified supported slips and receipts are saved immediately without review**, so occasionally incorrect OCR may still require editing the saved transaction. Missing or contradictory values block auto-save.
- Only the extracted transaction fields (direction, date, time, amount and recipient) are saved automatically when all validation gates pass. The image is not attached to the transaction. For photos in HEIC format, convert to JPG before scanning.

## Supported receipt formats (October 2026)

- **K PLUS**: outgoing bill/transfer or explicitly incoming receipt; amount, date, time and payee.
- **7-Eleven / 7Delivery**: shop/branch, receipt time, receipt ID and each item (name, quantity, unit price when determinable, line total). The tender line is the only transaction amount: item subtotals and discounts are structured metadata, never additional expense transactions. If OCR sees an item section but item totals/counts do not reconcile, automatic saving is blocked.
- **เป๋าตัง / G-Wallet**: merchant, reference, original goods value and subsidy/discount breakdown. For example, ฿40 goods − ฿24 subsidy means **฿16 recorded as expense**; both amounts are kept in structured receipt metadata. A contradictory money equation blocks auto-save.
- New formats are local OCR text parsers, not payment-provider integrations. The image is not uploaded or stored. Incomplete/unclear/duplicate-like scans are blocked and manual entry remains available. These parsers are tested against anonymized transcriptions of sample screenshots; actual iPhone Safari OCR still requires real-device evaluation.

## Quick start

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For tests and production build:

```bash
npm test
npm run build
npm run preview
```

Deploy `dist/` to any static hosting, e.g. Vercel (Vite static preset). To enable PWA service worker, deploy with HTTPS.

## Data model

```ts
type Transaction = {
  id: string; // UUID
  type: 'income' | 'expense';
  amountSatang: number; // safe positive integer, 1 baht = 100 satang
  category: string;
  note: string;
  date: string; // YYYY-MM-DD in user's local time
  time?: string; // HH:mm printed on the slip; optional for older/manual records
  recipient?: string; // payee printed on the slip
  method: 'cash' | 'bank' | 'card' | 'wallet';
  createdAt: number;
};
```

The store is **IndexedDB**, isolated to the site's origin. CSV exports include dedicated Date, Time, Amount and Recipient columns; JSON backup/restore preserves these fields and supports older records. **Manual and image-scanned entries do not sync across devices.** Confirmed iPhone Shortcut entries are imported one-way on each connected browser after one-time Review Token pairing. Removing site data, using private mode, or changing domains/browsers may cause data loss. **Download a JSON backup regularly.** A restore replaces all current transactions only after a confirmation. This is not encrypted storage: anyone with access to the unlocked browser profile/device may access the local data. Avoid importing backups from untrusted sources.

**Net cash flow** = recorded income − recorded expenses; this is *not* your bank balance and does not represent debts or assets. Expense categories include debt payments, but the app does not manage full loan balances or double-entry accounting.

## Mobile-first Slip-first UI

- Redesigned home layout for 320px-first mobile use: upload slip as the prominent action, manual entry as the alternative, recent transactions and financial summary.
- Simplified colors, flatter cards, clearer Thai typography, unobtrusive per-row action menu and bottom navigation.
- All default Add actions now open image selection first, with automatic saving when every required field is valid and direction is explicit. The parser supports K PLUS, 7-Eleven/7Delivery, and Paotang G-Wallet and captures the merchant, actual paid amount, payment method, date, and time. A missing OCR date or cash-flow direction never defaults silently. Duplicate-like slips are blocked. iPhone Shortcut pairing is available in Settings; linked browsers pull confirmed Shortcut records at startup/resume and approximately every 60 seconds while visible.
- See [Mobile-first design specification](docs/MOBILE_FIRST_DESIGN.md).
- GitHub's automated Chromium UX audit now covers 320, 375, 390, 430, 768 and 1280px.

## UX/UI fixes v0.3.0

- Historical UX fix: early Slip OCR used a separate review step; the current slip-first experience auto-saves valid, confidently classified receipts and keeps an error/manual fallback for ambiguous ones.
- Duplicate-like entries (same date, direction, amount, payment method) require explicit acknowledgment.
- Keyboard focus is trapped in the dialog, previous focus is restored, and background scrolling is locked.
- Budget and six-month charts respect the selected calendar month; the Dashboard prompts for JSON backups after multiple entries.
- Responsive navigation, screen-reader names, contrast, and touch targets have been improved; see `docs/UX_UI_AUDIT_2026-10-10.md`.
- Use `npm run build` and `npm test` before release; automated Chromium audit validates 320/390/768/1280px but cannot substitute for device Safari and real bank slip QA.

## Canonical repository

This code is hosted at https://github.com/kreecrypto/Money-Tracker and production deploys through Vercel on `main`. The application is currently deployed at https://money-tracker-beta-teal.vercel.app/. Visibility is controlled by the Vercel project protection settings.

## AI coding workflow — Ponytail Full

This repository follows [Ponytail](https://github.com/DietrichGebert/ponytail)'s **smallest complete change** approach through [`AGENTS.md`](AGENTS.md). AI coding agents should read that file alongside [`PRODUCT.md`](PRODUCT.md) and [`DESIGN.md`](DESIGN.md) before editing.

Reuse the existing code, browser primitives and current dependencies before adding abstractions. **Never trade away financial validation, slip OCR confidence/duplicate handling, user privacy, data-loss safeguards, accessibility or real iPhone Safari QA for fewer lines.** Check `pnpm test`, `pnpm run typecheck` and `pnpm build` plus relevant preview/device QA before merging.

`AGENTS.md` is a repo-scoped ruleset, **not the installed Ponytail CLI/agent plugin**. For optional mode switching and lifecycle hooks, install the [official plugin](https://github.com/DietrichGebert/ponytail/blob/main/INSTALL.md) in your coding agent separately; no package is added to the shipped app.

## Repository setup

Clone the existing repository:

```bash
git clone https://github.com/kreecrypto/Money-Tracker.git
cd Money-Tracker
npm install
npm run dev
```

## UX / roadmap

See [`docs/PRODUCT.md`](docs/PRODUCT.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and [`docs/QA.md`](docs/QA.md). Manual/photo OCR remains local; the optional iPhone Shortcut Text bridge uses Supabase with separate upload/review credentials and one-way import, without connecting to a bank account. A Vercel production domain is connected, but access may be restricted by Vercel Authentication.

## Security and privacy

- No credentials or account data in Git. `.gitignore` excludes local `.env` files.
- Manual and uploaded-image records remain in local IndexedDB. Text-only iPhone Shortcut imports are stored as parsed fields in Supabase and copied to IndexedDB after pairing. JSON backup files contain unencrypted financial data — store them securely.
- CSV cells beginning with spreadsheet formula trigger characters are prefixed to mitigate spreadsheet formula injection.
- This is personal finance tracking software, not regulated financial advice.

## License

MIT (see `LICENSE`).
