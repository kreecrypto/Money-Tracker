# Real-image OCR golden QA (private)

Money Tracker's `tests/kplus*.test.ts` and `tests/realSlipAmountRecovery.test.ts` use **sanitized OCR text**, not the actual Tesseract recognition of image pixels. The opt-in `tests/ocrRealImageGolden.test.ts` adds **image bytes → Tesseract (Thai+English, AUTO PSM) → visual rows → `parseSlipText` → `prepareAutoSlip`**. It uses the same initial recognition engine and parsing functions as the App; it does **not** reproduce browser canvas enhancement, crop retries, local storage, network sync, or iPhone Safari. Those still need device verification.

## Privacy (mandatory)

- Use authorized original K PLUS slips **only on your own computer/device**. Never upload unredacted bank images, OCR transcripts, names, account numbers, tokens, or `manifest.json` to public GitHub, PR comments, CI artifacts or support tickets.
- If sharing a screenshot for review, replace names, account/ref/QR identifiers with fictitious equivalents before sharing. Preserve payment/date/time labels and their geometry; avoid obscuring the amount being tested. Such edited images are privacy-safe regression aids, not proof of OCR on the untouched original.
- `tests/private-ocr/` (including the manifest and images) is excluded by `.gitignore`. The test outputs **only anonymous case IDs + mismatched field names**, not recognized text or amounts.

## Setup (local only)

1. Add a folder: `mkdir -p tests/private-ocr`
2. Copy one or more **real K PLUS image files** (`.png`, `.jpg`, `.jpeg`, `.webp`) into it. Use anonymous lowercase filenames such as `kplus-bill-01.png`; never put names/account details in the filename.
3. Create `tests/private-ocr/manifest.json`. This example uses **fictional** details — replace each expected field with the **visually verified** truth from your private image. Keep amounts as integer satang. Never let OCR itself provide the expected answer.

```json
{
  "cases": [
    {
      "id": "kplus-bill-01",
      "image": "kplus-bill-01.png",
      "expected": {
        "status": "ready",
        "amountSatang": 9000,
        "date": "2026-10-14",
        "time": "13:45",
        "direction": "expense",
        "recipient": "ร้านค้าทดสอบ"
      }
    }
  ]
}
```

4. If classification depends on account ownership, optionally add `"ownerNames": ["เจ้าของบัญชีตัวอย่าง"]` to that case **in the private manifest only**. For an unreadable/ambiguous image use `"expected":{"status":"incomplete","amountSatang":null}` (only fields you know should be checked).

## Commands and interpretation

```bash
pnpm install
pnpm test
RUN_PRIVATE_OCR=1 pnpm exec vitest run tests/ocrRealImageGolden.test.ts
pnpm run typecheck
pnpm build
```

The OCR model may download Thai/English traineddata during first local execution. If `RUN_PRIVATE_OCR=1` and the manifest/images are absent or invalid, the run **fails**; it cannot claim a green real-image check without real images. Without that environment variable, normal CI marks the private image suite as **skipped**, while its path/manifest guard tests still run.

When debugging: report only `case ID → stage → wrong field`, then form a single root-cause hypothesis and preserve the case as regression evidence. Add sanitized **text** fixtures for parser changes so public CI remains useful.

## Minimum real-device matrix (not yet verified by this harness)

| Priority | Capture type | What must be visually checked |
| --- | --- | --- |
| P0 | K PLUS transfer out | amount, date, time, receiver, expense → Saved |
| P0 | K PLUS bill/merchant payment | **paid amount**, never fee/ref, recipient → Saved |
| P0 | K PLUS incoming confirmation | sender/recipient ownership, income or Pending if unknown |
| P0 | K PLUS wallet top-up | classification is **expense** per product rule, no double-count guess |
| P0 | Blurred/cropped/contradictory label | no fabricated amount, **Pending** not a false Save |
| P0 | Same slip uploaded twice | exactly one record, duplicate status on second import |
| P1 | Gallery vs camera on iPhone Safari | same correct fields, safe area, lifecycle |
| P1 | 20-image batch | saved/duplicate/incomplete counts and performance |

The local image test is a **baseline first-pass OCR measurement**. Its failure is actionable; its success alone is **not sufficient** to claim all cases pass in actual iPhone Safari or the full multi-pass browser workflow. Keep Production gated until the P0 cases have private evidence.
