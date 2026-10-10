# เงินวันนี้ · Daily Money Tracker

Mobile-first, Thai-language, offline-first **daily income and expense tracker** (MVP v0.3.0). Uses a responsive React + TypeScript + Vite frontend and IndexedDB for local data storage.

## ✨ Features

- Add, edit, and delete income/expense transactions, including notes, date, category, and payment method.
- Monthly dashboard with net cash flow, monthly totals, category breakdown, and 6-month cash-flow chart.
- Monthly spending budget, overspending alert, search, and transaction type filters.
- Reports and category summaries, JSON backup/restore, and Excel-friendly UTF-8 CSV export.
- Installable Progressive Web App (PWA); offline usage after the first load.
- Financial amounts stored in **integer satang**, dates stored as **local calendar dates**.
- **Slip OCR**: from the Add Transaction form, capture or select a Thai/English bank transfer slip (JPG, PNG, WebP, max 10 MB). Tesseract.js extracts the amount, date (including Buddhist Era), and recipient when detectable. Review and edit fields before explicitly saving. No background auto-import.
- No account, server, bank access, tracking scripts, or analytics by default.

## Slip OCR privacy and limitations

- Image OCR runs inside the browser using Tesseract.js (Thai + English). On the **first scan**, the OCR engine and language files must be downloaded from their configured external CDNs; without those assets the scan does not work offline. The selected image and raw OCR text are only held in memory during scanning, and are **not uploaded to our server** or saved in IndexedDB.
- OCR results are estimates, not bank-verified transaction records. Account numbers, transfer references, and fee/balance lines must not be treated as the payment amount. Ambiguous fields remain blank; always verify against the original image.
- Only the explicitly confirmed form fields are saved. The image is not attached to the transaction. For photos in HEIC format, convert to JPG before scanning.

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
  method: 'cash' | 'bank' | 'card' | 'wallet';
  createdAt: number;
};
```

The store is **IndexedDB**, isolated to the site's origin. **It does not sync across devices**. Removing site data, using private mode, or changing domains/browsers may cause data loss. **Download a JSON backup regularly.** A restore replaces all current transactions only after a confirmation. This is not encrypted storage: anyone with access to the unlocked browser profile/device may access the local data. Avoid importing backups from untrusted sources.

**Net cash flow** = recorded income − recorded expenses; this is *not* your bank balance and does not represent debts or assets. Expense categories include debt payments, but the app does not manage full loan balances or double-entry accounting.

## UX/UI fixes v0.3.0

- Slip OCR now requires an explicit incoming/outgoing classification after recognition. No transfer is auto-saved. OCR review appears as a dedicated step inside the Add dialog.
- Duplicate-like entries (same date, direction, amount, payment method) require explicit acknowledgment.
- Keyboard focus is trapped in the dialog, previous focus is restored, and background scrolling is locked.
- Budget and six-month charts respect the selected calendar month; the Dashboard prompts for JSON backups after multiple entries.
- Responsive navigation, screen-reader names, contrast, and touch targets have been improved; see `docs/UX_UI_AUDIT_2026-10-10.md`.
- Use `npm run build` and `npm test` before release; automated Chromium audit validates 320/390/768/1280px but cannot substitute for device Safari and real bank slip QA.

## Canonical repository

This code is hosted at https://github.com/kreecrypto/Money-Tracker and production deploys through Vercel on `main`. The application is currently deployed at https://money-tracker-beta-teal.vercel.app/. Visibility is controlled by the Vercel project protection settings.

## Repository setup

Clone the existing repository:

```bash
git clone https://github.com/kreecrypto/Money-Tracker.git
cd Money-Tracker
npm install
npm run dev
```

## UX / roadmap

See [`docs/PRODUCT.md`](docs/PRODUCT.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and [`docs/QA.md`](docs/QA.md). MVP remains local-only: there is no Supabase or bank connection. A Vercel production domain is connected, but access may be restricted by Vercel Authentication.

## Security and privacy

- No credentials or account data in Git. `.gitignore` excludes local `.env` files.
- All financial records remain in local IndexedDB. JSON backup files contain unencrypted financial data — store them securely.
- CSV cells beginning with spreadsheet formula trigger characters are prefixed to mitigate spreadsheet formula injection.
- This is personal finance tracking software, not regulated financial advice.

## License

MIT (see `LICENSE`).
