# เงินวันนี้ — Money Tracker

## Platform
web (mobile-first responsive PWA, optimized for iPhone Safari; not a native iOS application).

## Product
A private, practical Thai-language income and expense tracker for everyday use. The primary path is **upload or capture a K PLUS transfer slip → extract date, time, amount, sender/receiver → classify → save**, with clear Pending review for ambiguous evidence. Manual entry, transaction history, reports, backup and settings remain accessible.

## Audience
People in Thailand who routinely handle bank transfer slips on their phones and want a dependable record of money received and spent without bookkeeping jargon.

## Jobs to be done
1. Record a K PLUS slip with minimal taps.
2. Confirm that the amount, direction (income vs expense), date and counterparty were saved correctly.
3. Review ambiguous items instead of silently fabricating missing facts.
4. Understand how much came in and went out this month.
5. Find, correct, export, back up or delete personal records.

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
The Home screen answers: what is the monthly net? how much came in/went out? how to scan a slip? what was saved recently? Additional pages support the next action without restating the dashboard.

## Source of truth
- App: `src/App.tsx`, `src/HomeScreen.tsx`, `src/SlipScanner.tsx`.
- Visual implementation: `src/home-screen.css`, `src/reference-parity.css`, `src/fintech-ui.css` and existing legacy CSS layers.
- CI: `.github/workflows/ci.yml`, `.github/workflows/ux-audit.yml`, `.github/workflows/safari-webkit-ui.yml`.
- Production domain: `https://money-tracker-beta-teal.vercel.app`.

This context is curated for Impeccable. Review whenever the product purpose or capabilities change.
