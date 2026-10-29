# Production release: iPhone / K PLUS QA — PR #96

**Release candidate:** the latest exact PR head SHA, rechecked before approving. P1 mobile UI, P0 financial truth, saved/pending/duplicate correctness.

## Evidence boundary

The WebKit and Chromium CI jobs use disposable simulated browsers and fictional financial data. The WebKit flow now closes a tab, reopens the same origin in the same browser context, checks saved transactions, Pending, exact calendar totals, and validates PWA manifest/service worker/icon HTTP responses. **This is not physical iPhone Safari, installed PWA, original K PLUS OCR, nor genuine offline validation.**

Public unit tests (`tests/slipAutoSave.test.ts`, `tests/pendingSlips.test.ts`, `tests/kplusSamples.test.ts`) use synthetic OCR text, not original bank images. The real-image harness in `tests/ocrRealImageGolden.test.ts` is skipped in normal CI.

## On-device evidence matrix (private)

Record device/iOS/Safari build, SHA, anonymized case ID, expected vs actual, and Pass/Fail. Keep actual slips and bank details out of GitHub, CI, and chat.

| ID | Test | Expected | Device evidence |
| --- | --- | --- | --- |
| IP-01 | Open exact-sha Preview on real iPhone Safari: Home, calendar, select date and return to today; normal and large fonts | No overlap, clipped digits, unresponsive controls, or horizontal overflow | UNVERIFIED |
| IP-02 | Authorized original K PLUS transfer-out from Camera and Photos | Actual OCR amount/date/time/recipient correct; expenses Saved only when unambiguous | UNVERIFIED |
| IP-03 | Original K PLUS merchant/bill slip | Amount is paid total, not fee/reference/QR; Saved or clearly Pending | UNVERIFIED |
| IP-04 | Real incoming slip and wallet top-up | Direction follows owner evidence; top-up = expense; ambiguous enters Pending | UNVERIFIED |
| IP-05 | Blurred, cut off, contradictory slip | No fabricated Saved; incomplete fields lead to Pending; totals unchanged | UNVERIFIED |
| IP-06 | Upload the exact same Saved slip again | Duplicate is shown; exactly one saved record, unchanged totals | UNVERIFIED |
| IP-07 | Close Safari tab and reopen; repeat by force-closing installed PWA | Saved/Pending and their counts/totals persist | UNVERIFIED |
| IP-08 | Add to Home Screen / standalone PWA; launch, gallery, camera, nav, keyboard, safe areas, airplane mode and reconnect | Controls usable and no data loss | UNVERIFIED |
| IP-09 | Compare saved records and day/month totals against independently verified values | Exact numbers; Pending excluded | UNVERIFIED |

### Local private pixel-OCR suite

Follow `docs/OCR_REAL_IMAGE_QA.md`, use authorized originals in ignored `tests/private-ocr/`, and run:

```bash
RUN_PRIVATE_OCR=1 pnpm exec vitest run tests/ocrRealImageGolden.test.ts
```

Never commit unredacted images, manifest, OCR text, identities or tokens. This test checks baseline image OCR only; it does not reproduce full iPhone/browser postprocessing.

### Release decision

All automated gates must be green at the **same SHA**. Real-device and original-slip results above plus human review must be recorded before changing Draft PR #96, merging to main, or deploying `https://money-tracker-beta-teal.vercel.app`. Without them, **NO GO**, and no Production mutation.

Do not erase personal data while testing. Use disposable browser profile/test data and private backup.
