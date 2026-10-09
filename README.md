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

Requires Node.js 20.19+ or 22.12+, and pnpm 10. CI uses pnpm to avoid an npm 10 dependency-resolution bug.

```bash
corepack enable
corepack prepare pnpm@10 --activate
pnpm install
pnpm dev
```

Open the local URL printed by Vite. For tests and production build:

```bash
pnpm test
pnpm build
pnpm preview
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

## Repository

Canonical repository: **https://github.com/kreecrypto/Money-Tracker** (`main`).

```bash
git clone https://github.com/kreecrypto/Money-Tracker.git
cd Money-Tracker
corepack enable
corepack prepare pnpm@10 --activate
pnpm install
pnpm dev
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
