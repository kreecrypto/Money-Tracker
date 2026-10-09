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
