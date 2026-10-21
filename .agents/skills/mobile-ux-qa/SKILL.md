---
name: mobile-ux-qa
description: Audit Money Tracker's Thai-first slip workflow, Home design system and Safari responsiveness before changing or releasing UI.
---

# Mobile UX QA — Money Tracker

Use for screen, component, CSS, copy, upload and navigation changes. This is a repo-local review workflow inspired by UI/UX Pro Max principles; **it is not an installation or vendored copy of the upstream package**.

## Before editing

1. Read `DESIGN.md` and `PRODUCT.md` plus affected `src/` components; check active PRs for overlapping files (notably [#66](https://github.com/kreecrypto/Money-Tracker/pull/66)).
2. State the user journey and the observable defect: Home → Upload Slip → Saved/Pending/Duplicate → Transactions → Reports → Settings.
3. Compare the proposed change against actual UI tokens and existing components. Do not invent a new style system or dummy finance data.

## Verify

- Thai text, hierarchy, readable signed amounts, clear CTA, contrast, focus, semantic controls and truthful empty/error/pending states.
- 320/375/390/430px iPhone layouts and 768/1280px; default and large reading sizes; no clipped amounts, horizontal overflow or safe-area overlap; upload targets ≥48px.
- Run `pnpm test`, `pnpm run typecheck`, `pnpm build`. Use existing `scripts/ux-audit.mjs` / `scripts/webkit-visual.mjs` and GitHub UX/UI + Safari/WebKit CI.
- Real physical iPhone Safari/PWA: upload from Photos/camera, scrolling, keyboard, back navigation, reload persistence, Saved/Pending/Duplicate. Browser WebKit screenshots are not hardware evidence.

## Report

List affected screens, viewport/mode, expected/observed result, code paths, checks and blocked conditions. Use anonymized screenshots only; no original slips or identities in issues or CI. **Never merge/deploy without relevant release gates.**

Tracking: [P0 UI #68](https://github.com/kreecrypto/Money-Tracker/issues/68) and [P0 OCR #67](https://github.com/kreecrypto/Money-Tracker/issues/67).
