# Money Tracker AI Skills rollout — P0–P2

## Required project delivery workflow

Before acting on any P0/P1/P2 issue, **read `docs/PROJECT_WORKFLOW.md`** (and root `AGENTS.md`) and execute its stages 00–12 with accurate tests and blockers. These issue priorities organize work; they do not override financial/privacy or release gates.


**Plan status: in progress, not a Production release.** This document concerns *agent development workflows*, not the broader feature-version priorities in `docs/ROADMAP.md`. Canonical product/design rules remain `PRODUCT.md`, `DESIGN.md`, and `AGENTS.md`. Last reviewed 2026-10-21.

| Priority | Agent workflow | Already present | Next gate | Issue |
| --- | --- | --- | --- | --- |
| P0 | Superpowers systematic debugging for real K PLUS OCR | `.agents/skills/systematic-debugging/SKILL.md` + private goldens, merged #65 | original private photos and physical-iPhone evidence; no false Saved | [#67](https://github.com/kreecrypto/Money-Tracker/issues/67) |
| P0 | UI/UX Pro Max-inspired mobile UX audit | `DESIGN.md`, browser UX/WebKit workflows, UI work in draft PR #66 | actual iPhone Safari/PWA and visual sign-off | [#68](https://github.com/kreecrypto/Money-Tracker/issues/68) |
| P1 | Ponytail reuse-first safe refactoring | `AGENTS.md`, merged #64 | small scoped changes with regressions; no financial behavior drift | [#69](https://github.com/kreecrypto/Money-Tracker/issues/69) |
| P1 | Agent Skills-style API/security/release review | existing GitHub CI/UX/WebKit/Impeccable workflows | isolated Preview staging, negative auth tests, reviewed release checklist | [#70](https://github.com/kreecrypto/Money-Tracker/issues/70) |
| P2 | Graphify-like dependency mapping | `docs/ARCHITECTURE.md` | map actual file dependencies, assess external Graphify later | [#71](https://github.com/kreecrypto/Money-Tracker/issues/71) |

## Available repo-local entrypoints

- Bug or OCR issue: `.agents/skills/systematic-debugging/SKILL.md` (existing, based on Superpowers).
- UI or UX issue: `.agents/skills/mobile-ux-qa/SKILL.md` (new original tailored review procedure; not the external UI/UX Pro Max package).
- Auth, backend, data safety or release: `.agents/skills/security-release-review/SKILL.md` (new original tailored checklist; not an external Agent Skills plugin).
- Cross-layer changes: `.agents/skills/architecture-impact-map/SKILL.md` (new original procedure; no Graphify install).
- Every task: `AGENTS.md` (existing Ponytail-derived reuse-first rules).

## Sequence / definition of done

1. **Inspect** latest main + relevant PRs + affected files and tests. Do not duplicate #64/#65 or collide with open UI PR #66.
2. **P0 correctness**: private image-golden test is deliberately opt-in; CI skip ≠ OCR accuracy. Prove transfer out, merchant paid amount, incoming ownership, wallet top-up expense, ambiguous Pending, duplicate; verify saved totals and persistence on *physical iPhone*.
3. **P0 UI**: 320/375/390/430, both reading sizes, no overflow, truthful labels, usable upload CTA, device QA. Check the real approved Home design reference (never infer screenshot fidelity from CSS tests alone).
4. **P1 review**: use Ponytail's smallest safe diff plus security review. Test authenticated Preview end-to-end **only** with isolated staging, not the Production database. Add regression coverage for concrete defects.
5. **P2 mapping**: document verified imports/flows, data boundaries, ownership/security invariants and impact. Avoid a new graph dependency unless its benefit and data exposure have been reviewed.
6. **Release**: `pnpm test` → `pnpm run typecheck` → `pnpm build` → GitHub Actions checks → Preview QA → physical-iPhone UAT for P0 → explicit sign-off → merge → Production deploy → smoke test.

## Safety and out-of-scope

- Nothing here guarantees OCR fixes or installs vendor AI plugins. Repo-local skill files are guidance for agents that read them.
- Do not commit `tests/private-ocr/`, original bank slip data, names, QR/ref numbers, tokens or OCR transcripts.
- Never fabricate or silently save uncertain amount/direction; keep Pending and Duplicate honest.
- Do not add Graphify, agent runtime frameworks, secrets, new workflows or external API access merely to complete the roadmap.
- Any missing staging, private image or physical device result remains a release blocker, not a silently passed test.

Related active branches: [PR #66](https://github.com/kreecrypto/Money-Tracker/pull/66) and [PR #63](https://github.com/kreecrypto/Money-Tracker/pull/63).
