# Slip OCR (MVP 0.2.0)

## How to use
1. Tap **เพิ่มรายการ** → **สแกนสลิปโอนเงิน**.
2. Select a JPG/PNG/WebP slip (up to 10 MB), or tap **ถ่ายรูป**.
3. Wait for Thai + English text recognition to complete.
4. Review the proposed transfer amount, date and recipient against the slip.
5. Choose **ใช้ข้อมูลนี้ในฟอร์ม**, correct any mistakes, choose category and income/expense.
6. Choose **บันทึกรายการ**. Scanning alone does not create a transaction.

## Accuracy and safety
- The feature is designed for **bank transfer slips**, not itemized store receipts.
- OCR is not a banking API and does not establish that a transfer really occurred.
- The parser prioritizes amount labels and excludes balance, fee, account number, and reference lines.
- Dates support Thai Buddhist Era, numeric format, and English/Thai abbreviated months.
- Ambiguous amounts are left blank; a human must enter or verify them.
- The photo and full OCR text stay in the active browser UI memory; no photo attachment is persisted in IndexedDB and no application server receives the photo.
- Tesseract.js and the Thai/English traineddata are downloaded from third-party CDNs on first use. They may not be available offline until cached by the OCR library/browser. If your browser or device cannot load those resources, enter data manually.
- Photos containing other people's bank details should only be handled with appropriate care and permission.

## QA
`tests/slip.test.ts` covers Thai/English labels, Thai numerals, Buddhist Era conversion, English/ISO dates, fee and account number false positives, ambiguous amounts, invalid calendar dates and empty recognition. Real-bank-image accuracy, iOS camera and edge cases still need device-based verification.

## Known limitations
HEIC photos require conversion to JPG/PNG/WebP. Automatically identifying an incoming versus outgoing transfer from the image is intentionally disabled; the user chooses income or expense. Duplicate slip detection and cryptographic verification of slip QR codes are out of scope.


## K PLUS sender-side OCR regression set (2026-10-13)
- Ten synthetic, privacy-safe text fixtures in tests/kplusSamples.test.ts model successful transfers (3), bill payments (5), and merchant payments (2).
- The K PLUS parser in src/lib/kplus.ts locates the sender bank and masked sender account before reading an unlabelled beneficiary block. Supports Thai names, PromptPay, merchant IDs and multiline shops.
- The existing amount parser prioritizes จำนวน above fee/balance/reference, and reads Thai Buddhist Era dates and 24-hour local times.
- A complete sender-side K PLUS confirmation is classified as an expense for the sender. A screenshot received from somebody else can instead represent income to its recipient; OCR cannot prove who owns the account.
- เลขที่รายการ is retained as a K PLUS receipt reference when legible for duplicate checking. It is not proof of settlement or QR verification.
- Original bank images are not committed to this public repository. Fixtures replace real names, accounts, transaction references and payment amounts, while preserving the ten layouts.
- Conflicting or missing OCR fields continue to require correction, not speculative saving.

### QA
Run npm test, npm run typecheck, and npm run build. The synthetic fixtures verify the text parser, auto-save readiness, reference duplicate check, and fee rejection. Real image-level OCR on iPhone/Safari is an additional E2E validation gate.


## Seven extra K PLUS screenshot layouts (2026-10-13)
- Additional synthetic OCR samples: 2 bank transfers, 3 merchant/bill payments, 1 payment ticket, 1 e-Wallet funding/top-up.
- Includes an exact one-satang value (`0.01 บาท`), independently from the zero-fee field. Do not auto-save if the amount is indistinct.
- Handles recipient text before bank details, Thai honorifics, PromptPay, long merchant identifiers, multiline English biller text.
- `เติมเงินสำเร็จ` to a G-Wallet / PromptPay e-Wallet is treated as wallet funding with ambiguous expense direction. The user must decide whether to record a bank-only cash flow or exclude an internal wallet transfer. This protects budgets from counting both the funding and later wallet spend as separate purchases.
- The public GitHub tests contain substituted identities, references and bank details, not real uploaded slip images; raw image-level Tesseract testing on iPhone is still required.
- Run `pnpm test` and `pnpm build` for the expanded regression suite.

## OCR robustness update — 14 October 2026

### Payment accuracy (K PLUS / generic bank text)
- The payment amount parser now scans all trusted payment labels in the *same* slip. If two labels disagree (e.g., จำนวน 125.50 versus ยอดชำระ 128.50), no value is automatically selected; the record is placed in **รอตรวจจากสลิป**.
- For line-wrapped amounts, the next line must itself look like a monetary value. Merchant names, item counts, references, fee and account lines are not candidates.
- Correctly labelled repeated amounts and the existing one-satang K PLUS fixture continue to parse.

### Image recovery / confidence
- Narrow screenshots may be upscaled up to 2× for the **recovery pass** only, bounded by 1800px width, 2100px height and 2.7 megapixels.
- Enhanced canvases use an opaque white base for transparent PNG pixels; the original image is not modified or stored.
- Tesseract page confidence below **55** triggers an additional enhanced OCR pass even if the first pass found four fields. For those low-confidence captures, a second pass must have confidence >= 55 and independently agree on amount, date, time, recipient and cash-flow direction before auto-save. Otherwise the slip remains in the existing local pending-review queue.
- 55 is a conservative product heuristic, **not** a calibrated probability of correctness or proof of payment. High page confidence likewise cannot prove any single amount is right.
- Recovering OCR data is local to the browser; images and full OCR transcripts are not persisted. The pending queue only stores the structured fields needed for review.

### QA and known limitations
- `tests/ocrRobustness.test.ts` checks contradictory payment amounts, unrelated numbers, item counts, one satang, low-confidence rechecks and image-scaling bounds.
- Passing synthetic text fixtures and typechecks is **not** an image recognition accuracy claim.
- Before deploying, run a privacy-safe real-device matrix on iPhone Safari: K PLUS bill/transfer/top-up, 7-Eleven and subsidized wallet receipts; direct camera, Photos JPG/PNG/HEIC, 1/20 files, small/blurred/low-light screenshots, auto-save versus pending-review, OCR retry speed and memory, cross-session pending persistence, and duplicate prevention.
- This update does not add support for other banks or QR-payment verification.

## iPhone image OCR follow-up (14 October 2026)

- On-device OCR cannot be diagnosed from Vercel server logs. A successful HTTP response or deploy is not evidence that Safari recognized a slip image.
- The previous low-confidence gate could require manual review even when two independent OCR passes agreed on all five ledger fields because **page-level confidence** includes QR codes, logos and watermarks. Two agreeing readings now permit auto-save even if both pages have low confidence; any missing/contradictory field still requires review.
- OCR startup has a 90-second deadline and each recognition pass has a 65-second deadline. A stuck recognition shows a Thai error and stops the remaining batch rather than reusing a potentially broken worker.
- The stop action terminates the browser OCR worker rather than waiting for the current page to finish. No bank photo or OCR transcript is sent to the server.
- These changes do not prove image accuracy on real iPhone Photos or HEIC. Reproduce using one original screenshot at a time, record whether the failure is loading, recognizing, retry, saving or pending review, and compare the parsed amount/date/time/merchant to the image. Redact identities and bank account numbers before sharing any evidence.
