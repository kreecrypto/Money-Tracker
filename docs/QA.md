# QA evidence — 2026-10-10

## Completed in the artifact-creation environment

- [x] TypeScript syntax transpilation checks: `src/App.tsx`, `src/main.tsx`, `src/lib/*.ts`, `tests/finance.test.ts`.
- [x] `tsc --strict --noUnusedLocals --noUnusedParameters` for the three core domain/storage modules (`finance.ts`, `backup.ts`, `storage.ts`).
- [x] Node.js smoke checks: 11 checks covering cent parsing, aggregation, month rollover, impossible calendar dates, backup round-trip, duplicate IDs, and CSV formula handling.
- [ ] Full `npm run build` and `npm test` from project root: **not run**; package install could not resolve `registry.npmjs.org` in the artifact environment.
- [ ] React desktop/mobile browser UI test: **not run** (dependencies unavailable here).
- [ ] PWA iOS/Android device installation test: **not run**.
- [ ] Production deployment: **not done**.
- [x] GitHub repository created by owner, and initial source imported to `kreecrypto/Money-Tracker` (`main`).

## GitHub CI verification

- [x] Install dependencies with pnpm 10 in GitHub Actions.
- [x] Unit tests passed and production TypeScript/Vite build passed at commit `cff92b76e000e66e4b5bddd542667bda9560301a` (workflow run [37970476651](https://github.com/kreecrypto/Money-Tracker/actions/runs/37970476651)).
- [ ] Manual desktop/mobile browser QA, real-device PWA QA, and production deployment still pending.

## Before production

1. Run `npm install`, `npm test`, `npm run build`.
2. Open Chrome DevTools and check mobile layouts at 320px, 375px, 414px, and desktop at 1280px.
3. Test create, edit, delete and filtering around year-end and leap day.
4. Save a backup; restore from it; compare exact counts/amounts.
5. Confirm offline navigation after the first successful PWA install and full reload.
6. Confirm keyboard navigation, focus, screen reader labels, and contrast.
7. Deploy to an HTTPS origin and verify data persistence after relaunch.
