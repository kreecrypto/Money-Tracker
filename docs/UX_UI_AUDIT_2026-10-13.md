# Money Tracker — Slip-first UX/UI Audit & Improvement (13 Oct 2026)

## Review scope
- Source: Money Tracker `main` after K PLUS OCR top-up updates (baseline `fc80a837`).
- Paths: Home → Upload slip(s) → Local OCR → Auto-save / Pending review → Transactions; Manual Add; wallet top-up exceptions.
- Methods: React interaction/IA/Thai UX writing/static CSS review plus GitHub browser QA at 320px–desktop.
- Out of scope / not proven: Pixel-perfect real iPhone Safari screenshots, VoiceOver on physical device, live-bank verification, real slip-image OCR success rate, new production deployment.

## Findings and fixes

| Severity | Finding | User impact | Implemented acceptance criteria |
|---|---|---|---|
| P0 | OCR uncertain direction defaults to expense inside correction form | May book legitimate income or a transfer as spending | Start with unselected type, require user choice, show inline validation before save |
| P0 | Wallet funding (bank to own G-Wallet) appears in expense correction flow | Funding plus subsequent wallet purchases can be counted twice | Explain internal transfer, provide explicit "ไม่นับรายการนี้" path; exclusion creates no transaction and appears in per-batch results |
| P0 | A batch with incomplete OCR was announced visually as success | User may close without correcting and assume all slips saved | Warning headline/status if any incomplete/failed, separate saved/duplicate/pending counts and direct scroll-to-review CTA |
| P1 | Correction form omitted category selector | Every OCR-corrected purchase fell into a generic or inherited category | User can choose expense/income categories and category resets safely when type changes |
| P1 | Dismissing scanner discards pending corrections silently | Lost manual effort or expected bookkeeping entry | Confirm exit for unresolved corrections through Escape, backdrop, close or switching to manual entry |
| P1 | Double close icon in mobile slip sheet | Unclear visual hierarchy and extra close affordance | Keep modal header close and one completion action |
| P1 | Uploading a new batch hides previous incomplete correction inputs | Difficult to reconcile skipped slips | Disable next upload until current pending correction entries are resolved or user consciously leaves |

### Expected primary user journey
1. Tap **เพิ่มสลิปหรือใบเสร็จ** from Home. Select up to 20 images.
2. OCR reads locally, tries enhanced recovery only for missing/ambiguous data.
3. When full and reliable, transaction saves automatically and appears in Transactions; duplicate entries are not added.
4. When incomplete, no transaction is added, the result headline is **ยังมี ... รูปที่ต้องตรวจ**, and **ตรวจ ... รายการที่ยังไม่บันทึก** scrolls to correction fields.
5. Correction requires an explicit direction if unknown, date, time, amount, recipient and a category; successful correction updates the batch immediately.
6. For an e-Wallet funding transfer, **ไม่นับรายการนี้ (โอนเงินระหว่างบัญชีตัวเอง)** records an exclusion **in this batch only**, without adding a ledger transaction.
7. Closing while pending prompts before losing unfinished correction drafts. Completed/saved ledger entries remain intact.

## IA and content audit

- Preserve main mobile navigation: **ภาพรวม / รายการ / รายงาน / ตั้งค่า**. The main Home action remains slip upload; manual entry is secondary.
- Distinguish processing, saved, duplicated, pending review, failed, excluded and undone. **ประมวลผลครบ** must not mean **บันทึกครบ**.
- Treat "เงินออก / รายจ่าย" and "เงินเข้า / รายรับ" as distinct explicit choices. A missing OCR direction is neither.
- Never claim bank verification; OCR and transaction reference are not proof of payment.
- User banking images remain local to OCR and are not committed to public GitHub; sanitized tests use layout-only text examples.

## Remaining prioritized UX tasks (NOT part of this implementation)

1. **P1 — iPhone device QA**: 320/375/390/430px, iOS Safari file picker, camera, HEIC, >1 slip, focus/keyboard safe area, VoiceOver and reduced motion.
2. **P1 — Persistence expectation**: make clear when records live only in browser/device versus cloud sync. Verify backup/restore before users depend on financial histories.
3. **P1 — Cross-session pending review**: corrections currently live in the modal session; consider a secure **รายการรอตรวจ** queue if users routinely import many slips and leave mid-batch.
4. **P2 — Transaction IA**: add structured source/method facets and clearer separation of OCR-generated versus manual records if users need reconciliation.
5. **P2 — Reporting**: allow excluding funding transfers from spending charts by design, with future explicit transfer type only after product/data-model agreement; avoid shoehorning transfers into "expense".
6. **P2 — Semantic notification intent**: use typed success/warning/error toast variants instead of an all-success icon; optionally test announcements with VoiceOver.

## QA gates
- `pnpm test`
- `pnpm build` (TypeScript and Vite production)
- GitHub `UX/UI Audit` browser workflow (responsive/touch/axe checks)
- Real device UAT remains separate from CI and production deployment.

## Code changes
- `src/SlipScanner.tsx`: correction states, category chooser, wallet opt-out, pending-result summary/CTA.
- `src/App.tsx`: safe dismissal and user-facing batch notice.
- `src/lib/slipReview.ts`: review defaults/heading logic.
- `src/lib/slipBatch.ts`: `excluded` per-batch status (never persists as a transaction).
- `src/daily-minimal.css`: minimal warning and corrective-workflow presentation.
- `tests/slipReviewUx.test.ts`: regression cases.

**Important:** Vercel deploy and real-image OCR UAT must be verified independently. Passing text/parser tests cannot establish image-level recognition accuracy.
