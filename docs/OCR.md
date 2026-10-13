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
