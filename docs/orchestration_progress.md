# Orchestration Progress — Iteration: Automate, Simplify, Clarify

**Objective (verbatim):** "Automate the process, simplify the UI/UX, and create a clear user flow and user story."

**Status:** 🟢 Phase 2 in progress
**Last updated:** 2026-10-20

---

## 1. Scope

**In scope (P0)**
- A-1 (Automation): `POST /api/ai/generate-prompt` and `aiGeneratePrompt()` extend to accept optional `role`, `variables`, `constraints`, `examples`; generation message composition **uses** these inputs (fixes verified bug: previously only `goal` was sent — `src/client/modules/PromptCreator.tsx:23` vs fields at `:86-89`).
- UX-1 (Simplify): `src/client/App.tsx` navigation restructured from 14 flat tiles into a primary guided journey (Create → Evaluate → Optimize → Library) with grouped Advanced/Manage sections. All 16 modules remain reachable — no capability removal.
- UX-2 (Clarity): PromptCreator gains an explicit, ordered single-screen flow: Goal → optional context (collapsible "Add context") → Generate → Result → Save.
- Docs: `docs/specifications.md`, `docs/architecture.md`, `docs/api.md`, `docs/setup.md`, `docs/user-flows.md` created/updated in parallel.
- Same-PR E2E/test updates for any renamed text or selectors.

**Out of scope**
- No removal of modules, endpoints, `{ok,data,error}` envelope, CSP (`connectSrc 'self'`), rate limiting, or auth.
- No new AI providers/origins; no DB schema changes.
- Deep SkillCreator context-fields parity (SkillCreator has no ignored fields today; goal-only is by design). Re-evaluate post-Gate 2 if trivially cheap.

**P1 backlog (post-Gate-4 if capacity):** skill-efficiency parity (context-aware generate-skill), wizard-style multi-step creation.

## 2. Roadmap

| Phase | Work | Owner | Handoff criteria (Definition of Done) |
|---|---|---|---|
| P1 Research | Scope, stories, flows, requirements (26) | product-manager ✔ | `docs/phase1-research.md` written; verified code facts |
| P1 Spec | specifications + progress tracker | Lead ✔ | Both docs exist, consistent, linked |
| P2 Backend | schemas/route/service/context composition + unit tests + api.ts client wrapper | ai-engineer | `swagger`: unit tests pass; zod optional fields at bounds; goal-only fallback covered |
| P2 Frontend | App navigation simplification + PromptCreator single-flow wiring + E2E updates | frontend-developer | Modules reachable; flows.spec/modules.spec updated; lint+typecheck clean |
| P3 Gate 1 | Unit suite + coverage | test-results-analyzer | All pass; critical-path (message composition) covered |
| P3 Gate 2 | Integration + build + lint + typecheck | test-results-analyzer | All pass; contracts validated |
| P3 Gate 3 | E2E 3 browsers + a11y | test-automation-engineer | 0 failures ×3 projects; axe clean; no console errors |
| P3 Gate 4 | Perf/security audit | security reviewer | Scan output + risks w/ remediation |
| P4 | Commit/push, final report | git-workflow-master / Lead | All gates green, docs consistent |

## 3. Decisions log

| # | Date | Decision | Rationale |
|---|---|---|---|
| D1 | 2026-10-20 | Extend existing endpoints with optional zod fields instead of new endpoints | Keeps `{ok,data,error}` contract, rate limits and CSP untouched (NF-3) |
| D2 | 2026-10-20 | Simplify navigation by grouping into primary journey, not deleting modules | Protects existing capabilities; E2E blast radius minimized |
| D3 | 2026-10-20 | All UI-text renames ship with same-PR E2E edits | E2E is copy-coupled (tests/e2e/*) |
| D4 | 2026-10-20 | Goal-only fallback when context fields empty | No behavioral regression for current users/tests |
| D5 | 2026-10-20 | SkillCreator parity deferred to P1 | Verified: no ignored fields exist in SkillCreator |

## 4. Blockers

- None open. (Resolved: subagent long outputs truncate in orchestrator view → all deliverables must be written to files with ≤15-line chat summaries.)

## 5. Quality gate checklist (live)

| Gate | Condition | Owner | State | Evidence |
|---|---|---|---|---|
| 0 | lint/typecheck green | devs | ✅ pass (both agents, exit 0) | docs/evidence/phase2-{backend,frontend}-verification.md |
| 0 | build green | devs | ✅ pass (187.77 kB JS) | docs/evidence/phase2-frontend-verification.md |
| 1 | unit tests 100% pass incl. composition tests | QA | ✅ 52/52 (8 files) · critical paths: ai.ts 74.6%, schemas.ts 77.8% | docs/evidence/iter2-gates-1-2-report.md |
| 1 | coverage report archived | QA | ✅ iter2-gate1-unit-coverage.log (stmts 27.47%, branch 19.52%) | docs/evidence/iter2-gate1-unit-coverage.log |
| 2 | integration tests pass; contract `{ok,data,error}` intact w/ optional fields | QA | ✅ 3/3 · envelope contract unchanged | docs/evidence/iter2-gate2-integration.log |
| 2 | dist build artifact produced | QA | ⬜ pending | |
| 3 | E2E 0 failures × chromium/firefox/webkit | QA | ✅ 108/108 across 3 browsers (8.0m) | docs/evidence/iter2-gate3-e2e.log |
| 3 | axe a11y scan clean per screen | QA | ✅ 21/21 screens, 0 violations | docs/evidence/iter2-gates-3-report.md |
| 3 | no unhandled console/pageerror in traced runs | QA | ✅ 0 pageerror, 0 console.error | docs/evidence/iter2-gate3-console.log |
| 4 | security scan + perf/a11y/resilience audit with remediations | auditor | ❌ FAIL (conditional) — H-1 SSRF in /api/ai/models & /test (pre-existing); M-1 no aggregate context cap (new); LOWs L-1/L-2 | docs/evidence/iter2-gates-4-report.md |
| ✅ Sign-off | docs complete & consistent; evidence under docs/evidence/ | Lead | ⬜ pending | |

## 6. Milestone log

- 2026-10-20 Phase 1 started; codebase recon completed (16-module map, verified ignored-fields bug).
- 2026-10-20 Phase 1 complete: `docs/phase1-research.md` (research analyst), `docs/specifications.md` (this iteration's spec), `docs/orchestration_progress.md`.
- 2026-10-20 Gate 3 complete (test-automation-engineer): `npm run test:e2e` exit 0 — 108/108 passed across chromium/firefox/webkit (8.0m, retries=0). Axe a11y 21/21 clean; console/pageerror spec 0 errors. One test-only artifact fixed (Playwright LIFO route shadowing in flows.spec.ts:54); trace confirmed app payload correct; no product code touched. Traces: docs/evidence/iter2-gate3-traces/.
- 2026-10-20 Gates 1-2 complete (api-tester): lint/typecheck/build exit 0; unit 52/52 with coverage (critical paths ai.ts 74.6%, schemas.ts 77.8%); integration 3/3; envelope contract unchanged. Note: `@vitest/coverage-v8` was missing and installed `--no-save`. Evidence: docs/evidence/iter2-gates-1-2-report.md.
- 2026-10-20 Phase 2 complete (ai-engineer + frontend-developer): context-aware `GeneratePromptSchema` + message composition + client `aiGeneratePrompt(goal, ctx)`; grouped navigation with primary journey CTA; single-flow PromptCreator; E2E request-body test. Deviations: no `.strict()` (matches existing zod style); whitespace-only goal still accepted per `BoundedText.min(1)` contract; group headings use role="group" to avoid selector ambiguity. Commit 57b6ad8; evidence docs/evidence/phase2-{backend,frontend}-verification.md.
