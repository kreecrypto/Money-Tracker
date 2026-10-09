# Architecture and safety

```text
React UI (src/App.tsx)
  ├─ Finance domain helpers (src/lib/finance.ts)
  ├─ Local IndexedDB adapter (src/lib/storage.ts)
  ├─ Export / import validation (src/lib/backup.ts)
  └─ Service Worker static asset cache (public/sw.js)
```

## Storage schema
IndexedDB `ngoentoday-db`, version 1:
- `transactions` keyed by `Transaction.id`
- `settings` keyed by `key` (`monthlyBudgetSatang`)

On restore, both stores are updated in one IDB transaction to avoid partial replacement. Data loaded from backups is schema-validated; duplicate ids are rejected. Do not add remote storage without explicit opt-in and authentication.

## Security checklist for future sync
- Supabase Auth with server-side session verification.
- RLS (`auth.uid() = user_id`) on every table, including sharing junction tables.
- Ownership checks on all reads/writes, rate limiting, server validation.
- Secrets only in server environment, never embedded in browser client.
- Design data export, delete-account process, consent and retention policy.

## Limitations
- Browser-stored data is not encrypted by this app.
- IndexedDB is per origin and browser profile; data loss is possible if storage is cleared.
- This is a personal tracker; no balance-sheet accounting.
- Offline asset cache is not equivalent to transaction backup.
