# Money Tracker (เงินวันนี้) — GitHub Copilot entrypoint

**Before every repository task** (including coding, bug investigation, issue triage, PR review and release), read [`docs/PROJECT_WORKFLOW.md`](../docs/PROJECT_WORKFLOW.md) and root [`AGENTS.md`](../AGENTS.md), then check the latest branch, issues, active PRs, `PRODUCT.md`, `DESIGN.md`, and relevant source/test files.

Use the project's stage **00–12** sequence: prioritize P0/P1/P2 → inspect → plan/skills → smallest implementation → tests → applicable UX/WebKit → PR/CI → isolated Preview QA → physical iPhone/security gate when applicable → sign-off → merge → verify Production SHA/domain → smoke/report.

- Never hallucinate evidence or claim an unrun test passed. A simulated WebKit browser and green CI are **not** proof of real K PLUS photos on a physical iPhone.
- If API sync changes, use separate staging Supabase and test tokens; never repoint Preview to Production DB.
- Keep financial safety (integer satang, duplicate protection, uncertain Pending, safe Auth/PII) over cosmetic changes.
- After finishing, report stage, changed paths, verification evidence, outstanding blockers and whether Production was actually verified.
- Refer to `docs/AI_SKILLS_P0_P2.md` for repo-local skill choices; do not install third-party plugins automatically.

These are repository instructions for capable tools that read Copilot instructions. They do **not** override task-specific user instructions, turn CI into physical QA, or schedule background work.
