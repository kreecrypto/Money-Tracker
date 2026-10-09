# เงินวันนี้ · Daily Money Tracker

Mobile-first, Thai-language, offline-first **daily income and expense tracker** (MVP v0.1.0). Uses a responsive React + TypeScript + Vite frontend and IndexedDB for local data storage.

## ✨ Features

- Add, edit, and delete income/expense transactions, including notes, date, category, and payment method.
- Monthly dashboard with net cash flow, monthly totals, category breakdown, and 6-month cash-flow chart.
- Monthly spending budget, overspending alert, search, and transaction type filters.
- Reports and category summaries, JSON backup/restore, and Excel-friendly UTF-8 CSV export.
- Installable Progressive Web App (PWA); offline usage after the first load.
- Financial amounts stored in **integer satang**, dates stored as **local calendar dates**.
- No account, server, bank access, tracking scripts, or analytics by default.

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

## Repository setup

Suggested GitHub repository: `daily-money-tracker` (private).

1. Create the repository via https://github.com/new (do **not** initialize with a README if pushing this complete project).
2. Run:

```bash
git init
git branch -M main
git add .
git commit -m "feat: initial daily money tracker MVP"
git remote add origin https://github.com/YOUR_USERNAME/daily-money-tracker.git
git push -u origin main
```

## UX / roadmap

See [`docs/PRODUCT.md`](docs/PRODUCT.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and [`docs/QA.md`](docs/QA.md). MVP is **not** yet connected to Supabase, banks, or a live domain.

## Security and privacy

- No credentials or account data in Git. `.gitignore` excludes local `.env` files.
- All financial records remain in local IndexedDB. JSON backup files contain unencrypted financial data — store them securely.
- CSV cells beginning with spreadsheet formula trigger characters are prefixed to mitigate spreadsheet formula injection.
- This is personal finance tracking software, not regulated financial advice.

## License

MIT (see `LICENSE`).
