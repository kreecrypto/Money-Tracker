---
name: systematic-debugging
description: Investigate Money Tracker bugs and OCR failures with evidence before changing production code. Adapted from obra/superpowers.
---

# Systematic Debugging — Money Tracker

Adapted from [Superpowers: systematic-debugging](https://github.com/obra/superpowers/tree/main/skills/systematic-debugging) by obra (MIT). This repository-local skill works alongside root `AGENTS.md` / Ponytail. It is a skill file for compatible agents, not a globally installed Superpowers plugin.

**Iron law: no fix without a reproduced root cause.** Keep the smallest complete change; never bypass financial validation to make an OCR sample pass.

## Phase 1 — Observe and reproduce

1. Describe one user-visible failure and record its environment (browser/iOS, image type, width, OCR phase, expected vs observed field, saved/pending/duplicate).
2. Reproduce with the smallest privacy-safe fixture; check recent commits, error messages, and actual caller paths.
3. Trace boundaries: image decoding → Tesseract language/worker load → first recognition → optional enhanced/crop passes → `receiptLayoutLines` → `parseSlipText` → `prepareAutoSlip` → IndexedDB/pending review or API sync.
4. For each boundary identify the **first point** at which the expected information becomes wrong. Never log full OCR transcripts, bank images, identifiers, names, tokens, or financial payloads to public CI or issues.

## Phase 2 — Compare the working pattern

Read `src/SlipScanner.tsx`, `src/lib/slip.ts`, `src/lib/slipImage.ts`, `src/lib/receiptIntelligence.ts`, `src/lib/slipAutoSave.ts` as applicable; compare a passing reference image/fixture against a failing case. Account for PSM mode, image enhancement, row coordinates, confidence and explicit paid-amount labels. Do not confuse text-parser unit tests with actual image recognition.

## Phase 3 — Hypothesize and isolate

State **one falsifiable hypothesis** (e.g. "Tesseract loses the payment label before parsing"). Test one variable at a time. Use `RUN_PRIVATE_OCR=1 pnpm exec vitest run tests/ocrRealImageGolden.test.ts` against local-only images, and the existing text-level tests for isolation. If the image read fails but manually provided OCR text parses, investigate recognition/cropping, not storage.

## Phase 4 — Test, fix, verify

1. Preserve a failing private real-image case plus a privacy-safe text-level regression when relevant.
2. Change only the root-cause code and any affected callers. Do not fabricate an amount or change an ambiguous transfer to auto-saved.
3. Run targeted tests, `pnpm test`, `pnpm run typecheck`, `pnpm build`, Safari/WebKit checks and real iPhone upload/Save/Pending verification before Production as relevant.
4. Report: failing case IDs (not filenames containing identities), failing stage, hypothesis, evidence, changed paths, test outputs, remaining uncertainty. If three attempts fail, reassess the architecture before another patch.

**Private image gate:** `tests/private-ocr/` is gitignored. A skipped image test means **not verified**, never OCR passed. Do not upload original bank slips to the public repository or CI. Follow `docs/OCR_REAL_IMAGE_QA.md`.
