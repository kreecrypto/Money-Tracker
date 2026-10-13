# Money Tracker — Persistent Slip Review Queue

Implemented: 13 Oct 2026. Feature branch: `feat/persistent-slip-review-queue-20261013`.

## User journey
1. Open **ภาพรวม → เพิ่มสลิปหรือใบเสร็จ** and choose up to 20 images.
2. Full OCR fields -> transaction is automatically saved and de-duplicated, unchanged from the previous flow.
3. Incomplete OCR fields -> a **draft** is saved to `pending_slips` in local IndexedDB and the scanning summary says **เก็บไว้ใน “รายการ → รอตรวจจากสลิป”**.
4. Close the scanner, reload, or come back another day. The outstanding count appears on Home and in the Transactions subtab.
5. Open **รายการ → รอตรวจจากสลิป**, then **ตรวจและแก้ไข**. Correct the amount, date/time, recipient, type, category and method. Click **บันทึกรายการนี้** to create the transaction. It then disappears from Pending.
6. If more work is needed, click **เก็บไว้ตรวจภายหลัง** to persist edits. For internal wallet transfers, **ไม่นับรายการ** removes the pending draft without changing income/expenses.
7. A duplicate transaction found on save will be removed from Pending without inserting the same payment again.

## Storage and privacy
- Schema migration: IndexedDB `ngoentoday-db` version **1 → 2**, adding `pending_slips` while preserving `transactions` and `settings`.
- Persist **only** the structured candidate fields (date, time, amountSatang, recipient, direction, category, method, reason, source file label, date added, optional image SHA-256 and transaction reference).
- Never persist bank photos, OCR raw text, QR-code payloads, full bank accounts or Tesseract block geometry in Pending.
- Pending entries are **not** ledger transactions, are **not** counted in Dashboard/Reports, and are **not** sent to a remote API.
- Entries are stored in the current browser/device profile. They will not appear on other devices and are **not included in the existing JSON transaction backup**. Clearing website data, private browsing cleanup or iOS storage eviction can remove this queue. This is local durable storage, not guaranteed permanent storage.
- Wallet transfers are not automatically categorized as expenses. Users can explicitly mark them as excluded (no ledger entry).

## QA acceptance
- Existing OCR parser safety and complete auto-save behavior remain unchanged.
- All tests: `pnpm test`; `pnpm build`.
- Browser interaction smoke uses synthetic local draft: seed IndexedDB -> reload -> see Pending badge -> open Transactions Pending tab -> correct -> save once -> Pending disappears -> saved transaction visible.
- Browser audit: six responsive viewports 320, 375, 390, 430, 768, 1280; axe WCAG scans.
- No bank screenshot or personal account data is committed into this GitHub repository.
- Real iPhone Safari + actual OCR images still need separate device acceptance testing before production release.

## Future iterations
- Clear source/processing origin chips (local OCR vs iPhone Shortcut) and reliable cross-device sync, if user opts in.
- User-controlled backup/restore of pending drafts with sensitive-data disclosures.
- OCR confidence per field and guided recovery for unreadable images.
