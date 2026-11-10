# [Feature Name] — Money Tracker Implementation Plan

> **Repo workflow is authoritative:** อ่าน `AGENTS.md` และ `docs/PROJECT_WORKFLOW.md` (ขั้นตอน 00–12) ก่อนทุกงาน; Template นี้เป็นเอกสารประกอบ ไม่แทนขั้นตอน PR/CI/Preview/QA/Release ที่บังคับอยู่ และไม่ถือว่ามี Superpowers/Ponytail runtime plugin ติดตั้งแล้ว

> **For AI Coding Agents:** ใช้ Superpowers `brainstorming` → `writing-plans` → `test-driven-development` → `requesting-code-review` / `verification-before-completion` ร่วมกับ Ponytail `full` และตรวจ Reuse ก่อนเขียนโค้ด หากมี skill สำหรับ execution ให้ใช้ `subagent-driven-development` หรือ `executing-plans` ตามความเหมาะสม

**Feature ID / Issue:** `[MT-XXX / #issue]`  
**Priority / Change type:** `[P0/P1/P2] / [UI, OCR/Finance/Storage, API/Auth, Docs-only, etc.]`  
**Base main SHA / Relevant PRs:** `[actual SHA + PR links]`  
**Owner / Reviewer:** `[ชื่อหรือทีม]`  
**Status:** `Draft / UX Approved / Planned / In Progress / In Review / Done`  
**Branch / Worktree:** `[feature/...]`  
**Spec:** `[docs/specs/<feature>.md]`  
**Plan:** `docs/superpowers/plans/YYYY-MM-DD-<feature-slug>.md`  
**Goal:** `[ผู้ใช้ทำอะไรได้สำเร็จ และทำไมจึงสำคัญ — 1 ประโยค]`  
**Architecture:** `[สรุปวิธีแก้ปัญหา 2–3 ประโยค หลังสำรวจโค้ดจริง]`  
**Tech Stack:** `[ระบุจาก repository จริง ห้ามเดา]`

## วิธีใช้ Template

1. คัดลอกไฟล์นี้เป็น `docs/superpowers/plans/YYYY-MM-DD-<feature-slug>.md` แล้วกรอกช่อง `[ ... ]` ตาม Feature ใหม่
2. ให้ Agent สำรวจ repository, Design System และ test baseline ก่อนเสนอแนวทาง ห้ามเดาชื่อไฟล์หรือ framework
3. ทำ Phase 1 ให้ได้รับอนุมัติ UX Spec ก่อนเริ่ม implementation จากนั้นผ่าน Reuse Gate และ Plan Gate
4. ใช้ Ponytail แบบ reuse-first ตาม `AGENTS.md` เสมอ; หากติดตั้ง Ponytail plugin ที่รองรับโหมด `full` แล้วจึงเปิดใช้ตามคู่มือเวอร์ชันนั้น (ห้ามสมมติว่า slash command ใช้ได้) และใช้ Test-Driven Development ในแต่ละ Task
5. ปิด Feature ได้เมื่อทั้ง 4 Quality Gates เป็น `PASS` พร้อมหลักฐาน; ถ้า `FAIL` ให้แก้ก่อน Merge และยังต้องผ่าน release gates ตาม `docs/PROJECT_WORKFLOW.md` (สำหรับงานเอกสารล้วนให้ทำ docs-only checks; mobile/API gate เป็น N/A พร้อมเหตุผล)

---

## Phase 0 — Context & Baseline

- [ ] บันทึก P0/P1/P2, linked issue, main SHA, open PRs, affected flow, risks และ gates ตาม `docs/PROJECT_WORKFLOW.md`
- [ ] ตรวจ project structure, route, components, hooks, API/services, data model, test tools และ coding conventions จริง
- [ ] อ่าน `PRODUCT.md`, `DESIGN.md`, Home V2 / Design Tokens ที่ใช้อยู่: สีรายรับ–รายจ่าย, Balance Card, Transaction Row, Month Selector, states และ responsive rules
- [ ] ระบุ transaction lifecycle และจุดที่เกี่ยวกับยอดเงิน, OCR, authentication หรือข้อมูลส่วนบุคคล (ถ้า Feature เกี่ยวข้อง)
- [ ] บันทึกคำสั่งจริง: `lint: [command]`, `typecheck: [command]`, `unit: [command]`, `integration: [command]`, `build: [command]`
- [ ] Run baseline tests; บันทึกสิ่งที่ผ่าน/ล้มเหลวก่อนแก้โค้ด

**Baseline evidence:** `[คำสั่ง + ผลลัพธ์ + commit/วันที่]`  
**Existing issues not caused by this feature:** `[ระบุหรือ None]`

## Phase 1 — Superpowers: Brainstorm & UX Spec

**User problem:** `[ปัญหาและบริบท]`  
**Target users / JTBD:** `[กลุ่มผู้ใช้และงานที่ต้องทำ]`  
**Scope (In):** `[รายการ]`  
**Scope (Out):** `[รายการ]`  
**Alternatives & trade-offs:** `[อย่างน้อย 2 แนวทาง พร้อมเหตุผลที่เลือก]`

**UX Flow:** `[Entry → Input → Validation → Save/Pending/Review ตาม product contract → Success/Failure]`  
**Screens / Component references:** `[ลิงก์ Figma/Design System/หน้าจอเดิม]`  
**UI States:** `[Default, Loading, Empty, Error, Success, Offline ถ้าเกี่ยวข้อง]`  
**Responsive & Accessibility:** `[320/375/390/430px, focus, keyboard, contrast, screen reader, touch target]`  
**Data & business rules:** `[กฎจำนวนเงิน วันที่ โซนเวลา รายรับ/รายจ่าย ฯลฯ เฉพาะที่เกี่ยวข้อง]`

### Acceptance Criteria (Given / When / Then)

| ID | Given | When | Then | Test level |
|---|---|---|---|---|
| AC-01 | `[บริบทผู้ใช้]` | `[การกระทำ]` | `[ผลลัพธ์ที่สังเกต/ทดสอบได้]` | `[Unit/Integration/UI]` |
| AC-02 | `[ข้อมูลไม่ถูกต้อง]` | `[ผู้ใช้ยืนยัน]` | `[เห็น error; ไม่บันทึกข้อมูลผิด]` | `[Integration/UI]` |
| AC-03 | `[เกิด retry/ซ้ำ]` | `[ส่งคำขอซ้ำ]` | `[ไม่เกิดธุรกรรมซ้ำ หากเกี่ยวข้อง]` | `[Integration]` |

**Design approval:** `[ชื่อผู้อนุมัติ, วัน, link]`

**Gate A — UX Spec & Acceptance Criteria:** `PASS / FAIL`  
ผ่านเมื่อ UX Flow, UI states, กฎธุรกิจ, measurable AC และขอบเขตงานชัดเจน พร้อมการอนุมัติ; **ห้าม implement ก่อน PASS**

## Phase 2 — Ponytail Full: Reuse Audit

ตรวจเส้นทางโค้ดที่ใช้งานจริงก่อนตัดสินใจสร้างสิ่งใหม่ โดยเรียงลำดับ: **Reuse existing → ใช้ native/browser/platform feature → ใช้ dependency ที่มีอยู่ → เขียน helper/component เฉพาะจุด → เพิ่ม dependency/architecture ใหม่เป็นทางเลือกสุดท้าย**

| Need | Existing candidate + file path | Decision (Reuse / Extend / New) | Why | Risk |
|---|---|---|---|---|
| `[UI component]` | `[path]` | `[decision]` | `[reason]` | `[risk]` |
| `[API/service]` | `[path]` | `[decision]` | `[reason]` | `[risk]` |
| `[validation/helper]` | `[path]` | `[decision]` | `[reason]` | `[risk]` |

- [ ] ไม่มี duplicate component, helper, hook หรือ service โดยไม่มีเหตุผล
- [ ] Dependency ใหม่ทุกตัวมีหลักฐานว่าของเดิม/Native ไม่ตอบโจทย์
- [ ] ไม่เพิ่ม abstraction, state management หรือ architecture เพื่อรองรับ Use Case ที่ยังไม่มี
- [ ] ไม่ลด validation, error handling, security, accessibility หรือ test coverage เพื่อให้ LOC ลดลง

**Gate B — Reuse Before New Code:** `PASS / FAIL`  
**Reviewer & evidence:** `[ชื่อ + ลิงก์ audit]`

## Phase 3 — Superpowers: Implementation Plan

**Plan strategy:** งานย่อยที่ตรวจสอบได้ (โดยทั่วไป 2–5 นาทีต่อ Task ตามแนวทาง Superpowers), dependency ชัดเจน และระบุ path/command ที่ตรวจพบจริง

| Task ID | Outcome | Files to change (exact paths) | AC | Tests | Depends on |
|---|---|---|---|---|---|
| T01 | `[behavior 1]` | `[exact paths]` | `AC-01` | `[test names]` | `None` |
| T02 | `[behavior 2]` | `[exact paths]` | `AC-02` | `[test names]` | `T01` |
| T03 | `[integration / UX]` | `[exact paths]` | `AC-03` | `[test names]` | `T01,T02` |

สำหรับ **ทุก Task** ให้กรอก:

- **RED:** `[test file + ชื่อ test + command + expected failure]`
- **GREEN:** `[โค้ดขั้นต่ำที่ทำให้ test ผ่าน + command + expected pass]`
- **REFACTOR:** `[สิ่งที่ปรับให้อ่านง่าย/Reuse โดยรักษาพฤติกรรม]`
- **Commit / Evidence:** `[commit hash, test output, screenshot ตามชนิดงาน]`

**Schema/API/auth change impact:** `[None หรือรายละเอียด migration, backward compatibility, rollback และผู้อนุมัติ]`  
**Execution approach:** `subagent-driven-development / executing-plans / team workflow`  
**Gate C1 — Plan Ready:** `PASS / FAIL` (Tasks มี exact paths, mapped AC, tests, verification และ dependencies)

## Phase 4 — Superpowers: TDD & Integration

ทำทีละ Task: **RED → GREEN → REFACTOR → Verify → Commit**; ห้ามสรุปว่า Test ผ่านโดยไม่มีผลการรันจริง

- [ ] Unit tests ครอบคลุม business logic, formatting/validation, boundary cases ที่เกี่ยวข้อง
- [ ] Integration tests ครอบคลุม UI ↔ service ↔ persistence และ error/retry หากเกี่ยวข้อง
- [ ] ทดสอบ loading/empty/error/success และ accessibility ของ Flow ที่เปลี่ยน
- [ ] ทดสอบจำนวนเงินแบบ exact (เช่น integer minor units หรือ decimal ตามระบบเดิม), rounding, dates/timezone ตามขอบเขตงาน
- [ ] ตรวจ duplicate transaction/idempotency, concurrent submission และ OCR Save/Pending/Review **เมื่อเกี่ยวข้อง** (สลิปที่ข้อมูลครบและชัดเจนสามารถ auto-save ตาม product contract; ambiguous/conflicting ต้องไม่ auto-save)
- [ ] Tests, lint, typecheck, build ผ่าน หรือบันทึกเหตุผลที่ไม่รันและความเสี่ยง (ถือว่า FAIL หากเป็น required check)

**Test evidence table:**

| Check | Command / Evidence | Result | Notes |
|---|---|---|---|
| Unit | `[command + summary]` | `PASS/FAIL` | `[notes]` |
| Integration | `[command + summary]` | `PASS/FAIL` | `[notes]` |
| Typecheck/Build (`pnpm run typecheck`, `pnpm build`) | `[commands + summary]` | `PASS/FAIL` | `[notes]` |
| UI / Accessibility | `[screenshots or audit]` | `PASS/FAIL/N/A` | `[notes]` |

**Default repo commands:** `pnpm test`, `pnpm run typecheck`, `pnpm build` (ตรวจ scripts ปัจจุบันก่อนรัน; อย่าถือว่าไม่มีผลรัน = PASS)

**Gate C2 — Unit + Integration Tests:** `PASS / FAIL`  
ผ่านเมื่อ AC มีหลักฐาน Test หรือ QA ที่เหมาะสม และ Required Checks ผ่านทั้งหมด

## Phase 5 — Security & Data Integrity Gate

สำหรับรายการที่ไม่เกี่ยวข้องให้ลง `N/A` พร้อมเหตุผล แทนการละไว้โดยไม่ตรวจ

| Check | PASS / FAIL / N/A | Evidence / Owner |
|---|---|---|
| ตรวจ authorization/ownership ทุกจุดที่เข้าถึงข้อมูลผู้ใช้ | `[ ]` | `[ ]` |
| Validate input ที่ trust boundary; กัน malformed/forged requests | `[ ]` | `[ ]` |
| ไม่เปิดเผย secrets, token, PII หรือข้อมูลสลิปใน log/test artifacts | `[ ]` | `[ ]` |
| ใช้รูปแบบจำนวนเงินแบบ exact; ไม่เกิดยอดคลาดเคลื่อน | `[ ]` | `[ ]` |
| ตรวจ create/update/delete totals และ transaction state consistency | `[ ]` | `[ ]` |
| ป้องกันการบันทึกซ้ำจาก retry / double tap / OCR และไม่ auto-save สลิปกำกวม หากเกี่ยวข้อง | `[ ]` | `[ ]` |
| มี rollback/recovery สำหรับ migration หรือ partial failure หากเกี่ยวข้อง | `[ ]` | `[ ]` |
| Failure paths ไม่สร้างข้อมูลบางส่วนที่ผิดหรือสูญหาย | `[ ]` | `[ ]` |

**Gate D — Security & Data Integrity:** `PASS / FAIL`  
ผ่านเมื่อไม่มี Critical/High unresolved findings และทุกกรณีที่ใช้จริงมี Evidence

## Phase 6 — Superpowers Review + Ponytail Full Review

**Superpowers (Correctness):**
- [ ] เทียบ implementation กับ UX Spec และ AC ทุกข้อ
- [ ] ตรวจ behavior, regressions, performance ที่เกี่ยวข้อง และผลทดสอบจริง
- [ ] Review findings ที่เป็น Critical/High ต้องปิดก่อน Merge

**Ponytail Full (Simplicity):**
- [ ] ทบทวน diff **และโค้ดรอบข้างที่เปลี่ยนพฤติกรรม**
- [ ] ลบ logic/abstraction ที่ซ้ำหรือไม่จำเป็น โดยไม่ลด safety/UX/tests
- [ ] ตรวจปัญหา bug, security, load, missing tests และ documented risks
- [ ] บันทึกเหตุผลสำหรับ code/dependency ใหม่ที่จำเป็น

**Review findings:** `[รายการ issue, severity, resolution, commit]`  
**Remaining risks / skipped checks:** `[ระบุชัดเจน หรือ None]`

## Definition of Done / PR Handoff

- [ ] **Gate A:** UX Spec & Acceptance Criteria = PASS
- [ ] **Gate B:** Reuse Audit = PASS
- [ ] **Gate C:** Plan + Unit/Integration Tests = PASS
- [ ] **Gate D:** Security & Data Integrity = PASS
- [ ] UI ตรง Design System / responsive / accessibility ตาม Spec
- [ ] ไม่มี Critical/High findings ค้างอยู่
- [ ] PR ระบุ changed files, user impact, screenshots (ถ้ามี UI), test results, risks, rollback
- [ ] Product/UX และ Engineering reviewers อนุมัติตามกติกาทีม

**PR / Review link:** `[URL]`  
**Additional repo release gates:** `[CI on exact SHA, Preview QA, real iPhone and private OCR when affected, isolated API staging when affected; N/A + reason for docs-only]`  
**Final verdict:** `READY TO MERGE / BLOCKED`  
**Approvers / Date:** `[ชื่อ, วันที่]`

---

### Reusable Agent Prompt

> ทำ Feature `[ชื่อ Feature]` ใน Money Tracker โดยใช้เอกสารนี้เป็น checklist บังคับ เริ่มจาก Superpowers brainstorming และสำรวจโค้ดจริง เปิด Ponytail `full` เพื่อทำ Reuse Audit ก่อนเสนอ implementation plan จากนั้นใช้ writing-plans, TDD แบบ RED–GREEN–REFACTOR และ review 2 ชั้น (correctness + simplicity) ห้ามเปลี่ยน production data, API contract, schema หรือ auth โดยไม่ขออนุมัติ ห้ามลด security, validation, accessibility หรือ tests เพื่อลดจำนวนบรรทัด รายงาน Gate A–D พร้อมหลักฐานก่อนเสนอ Merge

**หมายเหตุ:** ใช้ Template นี้ประกอบ `AGENTS.md` และ `docs/PROJECT_WORKFLOW.md` ซึ่งเป็นข้อบังคับจริงของ Repo; ต้องกรอก file paths, คำสั่งทดสอบ และ Architecture จาก Codebase ปัจจุบัน ใช้สกุลเงินหน่วยสตางค์ (integer satang) และปกป้องข้อมูลสลิป/PII ตาม product contract ทุกครั้ง