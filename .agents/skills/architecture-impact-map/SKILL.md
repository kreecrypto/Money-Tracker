---
name: architecture-impact-map
description: Trace existing money and slip data flow across frontend, OCR, storage, API and test boundaries before cross-layer changes.
---

# Architecture Impact Map — Money Tracker

Use when a task spans multiple modules, or when a regression cannot be localized. Start with source imports and `docs/ARCHITECTURE.md`; **Graphify is optional and not installed by this file**.

## Procedure

1. Locate real imports/callers and summarize the requested user flow, without running live financial data through analysis tools.
2. Map, only where verified in code: React screens → image/worker OCR → text reconstruction/parse → auto-save decision → Saved/Pending/Duplicate → IndexedDB/Transactions/Reports. Map optional iPhone API/server → Supabase separately.
3. Mark trust boundaries and security/finance invariants: integer satang; classification ownership; no fabricated OCR fields; duplicate/idempotency; local/remote split; no Preview → Production DB shortcuts.
4. For each impacted file list its callers, tests, interface/storage implications and release check. Affected unknowns must be labeled unknown, not filled with guesses.
5. Prefer a small Mermaid diagram/table added to `docs/ARCHITECTURE.md`; only evaluate Graphify if repeated architecture tracing justifies new tooling and a privacy review is completed.

## Output

- Source-grounded map (paths), user-facing impact, security boundaries, missing links, related test files and checks.
- No original slip, OCR transcript, token, financial record, or secret in diagram or graph.
- Refresh against merged `main` after unrelated active UI/API PRs close.

Tracking: [P2 architecture #71](https://github.com/kreecrypto/Money-Tracker/issues/71).
