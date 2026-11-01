# เงินวันนี้ — Money Tracker

## Platform
web (mobile-first responsive PWA, optimized for iPhone Safari; not a native iOS application).

## Product
A private Thai-language **personal accounting secretary and financial reporting app**. The primary experience is **open the app → select a calendar date → read all saved transactions for that date → open a transaction or monthly ledger**. Financial briefing, pending/backup notices and classified cash movements are accessible from Reports and other existing dedicated screens. Upload/capture K PLUS slips, email-ledger CSV import, Pending review, manual entry, backup, settings and transaction history remain the evidence-capture and correction tools; the app does not fabricate or certify financial statements.

## Audience
People in Thailand who routinely handle bank transfer slips on their phones and want a dependable record of money received and spent without bookkeeping jargon.

## Jobs to be done
1. Open the Home calendar and inspect recorded income, expense and all saved transactions for a selected date.
2. Know exactly how much came in, went out and was classified this month, with explicit caveats about wallet top-ups and debt repayment.
3. See Pending/uncategorized/possible-duplicate review work and open the supporting evidence.
4. Capture or correct transactions using K PLUS slip OCR, local email CSV and manual entry without silently fabricating missing fields.
5. Drill down, export, back up, reconcile manually and delete records safely.

## Brand commitments
- UI name: **เงินวันนี้**; Thai-first, warm, calm, trustworthy, precise.
- Main visual identity: deep green, white, softly green-tinted neutrals; restrained iconography.
- Operate mode (utility/app), not marketing/landing-page mode.
- Real data only. Never show invented sample transactions, growth percentages, completed OCR fields or successful sync states.
- Do not reintroduce duplicated Home shortcuts that already exist in bottom navigation.
- Keep the upload action prominent; settings, integrations and developer diagnostics are secondary.
- Avoid brittle CSS hacks that diverge between Mobile Safari and Chromium.

## Functional and safety constraints
- Preserve the existing transaction schema, API integrations, OCR and duplicate-detection behavior unless explicitly changing that feature.
- Prioritize KBank K PLUS slips; receipts may follow the already implemented paths.
- Saved, Pending and duplicate states must be distinguishable; uncertain OCR data must not be silently treated as correct.
- Sensitive financial content should not leak via UI diagnostics, analytics or screenshots.
- Minimize interaction steps without removing data-loss and privacy warnings.
- Ensure 320–430px layouts, safe areas, VoiceOver labels, 44px touch targets, focus and reduced motion.

## Success criteria
The Home screen contains only a calendar, the selected date's income/expense totals and its complete saved transaction list. On mobile the primary slip entry is a persistent FAB; on desktop it is in the Home header. The notification control remains available for Pending slips. Detailed briefings, review notices and account analysis are on Reports. The Reports screen groups saved cash out into debt repayments, wallet top-ups, unknown-purpose items and classified spending with an exact transaction drill-down. Monthly net is **not** a bank balance or certified accounting profit. Upload is visible but secondary to reading the brief; existing personal data remains local unless the user enables separate integrations.

## Source of truth
- App: `src/App.tsx`, `src/HomeScreen.tsx`, `src/SlipScanner.tsx`.
- Visual implementation: `src/home-screen.css`, `src/reference-parity.css`, `src/fintech-ui.css` and existing legacy CSS layers.
- CI: `.github/workflows/ci.yml`, `.github/workflows/ux-audit.yml`, `.github/workflows/safari-webkit-ui.yml`.
- Production domain: `https://money-tracker-beta-teal.vercel.app`.

This context is curated for Impeccable. Review whenever the product purpose or capabilities change.
