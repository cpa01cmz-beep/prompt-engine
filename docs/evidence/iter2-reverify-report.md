# Iteration 2 — Re-verification report

Re-verification runs by the **API Tester** agent (independent re-run of Gates 1 and 2).
Product code was **not modified** by this session: all product files touched in this
workspace are the ones already committed at `1435e2a`.

---

## Re-verification after remediation (1435e2a)

**Commit under test**: `1435e2a` — *fix(security): validate AI baseUrl origin (H-1 SSRF), cap aggregate
context (M-1), clear stale success banner (L-1)*

Files in that commit (product + tests):

| File | Kind |
| --- | --- |
| `src/worker/routes/ai.ts` | product (H-1 baseUrl origin gate) |
| `src/worker/schemas.ts` | product (M-1 aggregate context bound, `MAX_CONTEXT_CHARS = 64_000`) |
| `src/client/modules/PromptCreator.tsx` | product (L-1 stale banner) |
| `tests/unit/ai-baseurl-guard.test.ts` | **new test file** (17 tests) |
| `tests/unit/schemas.test.ts` | extended (+6 aggregate-bound tests) |
| `tests/e2e/flows.spec.ts`, `tests/e2e/iter2-console.spec.ts` | e2e (out of scope for Gates 1–2) |
| `docs/orchestration_progress.md` | docs |

Note: `docs/evidence/iter2-reverify-report.md` did not exist before this run; this file was created
by the re-verification session (the prior run's results live in `docs/evidence/iter2-gates-1-2-report.md`).

### 1. Commands and exit codes (Gate 1)

| # | Command | Log | Exit code |
| --- | --- | --- | --- |
| 1 | `npm run lint` | `docs/evidence/iter2-reverify-lint.log` | **0** |
| 2 | `npm run typecheck` | `docs/evidence/iter2-reverify-typecheck.log` | **0** |
| 3 | `npm run build` | `docs/evidence/iter2-reverify-build.log` | **0** (47 modules transformed, built in 6.50s) |
| 4 | `npx vitest run --config vitest.config.ts --coverage` | `docs/evidence/iter2-reverify-unit.log` | **0** |
| 5 | `npm run test:integration` | `docs/evidence/iter2-reverify-integration.log` | **0** |
| 6 | `npx vitest run --config vitest.config.ts tests/unit/ai-baseurl-guard.test.ts tests/unit/schemas.test.ts --reporter=verbose` (targeted new-test confirmation) | `docs/evidence/iter2-reverify-unit.log` (appended section) | **0** |

`@vitest/coverage-v8@5.0.5` was already present in `node_modules` (`--no-save` install from the earlier
run); no reinstall was needed and `package.json` / lockfile remained untouched.

Lint detail: **0 errors, 3 warnings** — all three are `Unused eslint-disable directive` warnings inside
generated `coverage/*.js` report assets (`block-navigation.js`, `prettify.js`, `sorter.js`).
`coverage/` is git-ignored (`.gitignore:22`) but is not in the eslint `ignores` list
(`eslint.config.js:8`), so these are generated-artifact noise, not source findings.
Typecheck emitted no diagnostics.

### 2. Pass/fail counts

| Suite | Result | Duration |
| --- | --- | --- |
| Unit (`vitest.config.ts`) | **9/9 test files, 75/75 tests passed** | 23.46s |
| — of which targeted re-run of new/changed files | **2/2 files, 34/34 tests passed** | 3.67s |
| Integration (`npm run test:integration`, `tests/integration/smoke.test.ts`) | **1/1 file, 3/3 tests passed** | 1.25s |

Zero failures, zero skipped, zero todo, no timeouts in either suite.

Delta vs the pre-remediation Gate 1 run (`docs/evidence/iter2-gate1-unit-coverage.log`:
8 files / 52 tests): **+1 test file, +23 tests** — exactly the 17 new `ai-baseurl-guard` tests plus the
6 new aggregate-bound tests.

### 3. Coverage (v8, `--coverage`)

| Metric | Pre-remediation (57b6ad8) | Post-remediation (1435e2a) | Delta |
| --- | --- | --- | --- |
| Statements | 27.47% (303/1103) | **34.70% (389/1121)** | +7.23pp |
| Branches | 19.52% (115/589) | **29.41% (180/612)** | +9.89pp |
| Functions | 16.56% (26/157) | **23.12% (37/160)** | +6.56pp |
| Lines | 28.36% (280/987) | **35.59% (357/1003)** | +7.23pp |

Touched modules under test: `src/worker/schemas.ts` 82% lines / 83.33% branches;
`src/worker/routes/ai.ts` 37.21% lines (route-level integration coverage is thin — the guard is still
exercised unit-wise via the route handlers).
`vitest.config.ts` defines **no coverage thresholds**, so `--coverage` cannot fail the run; the numbers
above are reported as measurements, not as an enforced gate.

### 4. H-1 remediation test — `tests/unit/ai-baseurl-guard.test.ts` (17 tests, all PASS)

Verified cases for **both** `POST /api/ai/models` and `POST /api/ai/test`:

| Requirement | Test (verbatim name) | Assertion | Result |
| --- | --- | --- | --- |
| reject link-local metadata IP (`http://169.254.169.254`) | `rejects link-local metadata IP over http before any fetch` | error `baseUrl must be a public https URL`, no upstream fetch | PASS |
| reject metadata IP over https too | `rejects https metadata IP before any fetch` | same, scheme alone is not sufficient | PASS |
| reject `http://localhost` | `rejects localhost over http before any fetch` | error `baseUrl must be a public https URL` | PASS |
| reject `https://localhost` | `rejects localhost over https before any fetch` | same | PASS |
| reject loopback IP | `rejects loopback IP before any fetch` | same | PASS |
| reject untrusted https origin | `rejects a non-allowlisted public origin when no caller key is supplied` | error `baseUrl origin is not allowed` (HTTP 400) | PASS |
| accept configured/trusted origin | `accepts the configured origin and attaches the env key only there` | accepted; env key attached only for the configured origin | PASS |
| accept allowlisted origin | `accepts an allowlisted origin from AI_PROVIDER_ALLOWLIST` | accepted | PASS |
| no key exfiltration | `never leaks the env key to an untrusted origin that brings its own key` | env key never sent to untrusted origin | PASS |
| unchanged validation | `still requires a model` (`/api/ai/test`) | error `model is required` | PASS |

### 5. M-1 remediation tests — `tests/unit/schemas.test.ts` aggregate bound (+6 tests, all PASS)

| Requirement | Test (verbatim name) | Result |
| --- | --- | --- |
| >64k total rejected | `rejects a context whose composed total exceeds the 64k limit` | PASS |
| at-limit accepted | `accepts a context exactly at the limit` (64,000 chars) | PASS |
| off-by-one boundary | `rejects a context one character over the limit` (64,001) | PASS |
| separator counted | `counts the variable separator toward the total` | PASS |
| per-field limits intact | `keeps per-field caps after the aggregate bound` | PASS |
| goal-only accepted | `still accepts a goal-only context` | PASS |
| (regression) per-field + item bounds | `rejects context fields exceeding text bounds`, `rejects variables with more than 50 items`, `rejects empty-string variable entries` | PASS |

Implementation cross-check: `src/worker/schemas.ts:12` `MAX_CONTEXT_CHARS = 64_000`, enforced at
`schemas.ts:127` with message `Total context is <n> characters; the limit is 64000`.

### 6. Gate verdicts

**GATE 1 (lint + typecheck + build + unit/coverage): PASS.**
Lint 0 errors, typecheck clean, build succeeds (47 modules, 6.50s), unit 75/75 across 9 files.
Both remediation areas (H-1 baseUrl guard, M-1 aggregate cap) are covered by dedicated, passing,
boundary-explicit tests; coverage improved on every metric.

**GATE 2 (integration): PASS.**
`npm run test:integration` exit 0 — 3/3 tests: health ok; validation failure returns JSON 400
`{ok:false}`; unmatched `/api` path returns JSON 404 envelope rather than the SPA shell.

**Residual observations (not gate blockers, no fixes applied per instructions):**
1. 3 lint warnings originate from generated `coverage/*.js` files; adding `"coverage"` to the eslint
   `ignores` list would remove them.
2. No coverage thresholds are configured, so coverage regressions cannot fail CI.
3. `src/worker/routes/ai.ts` line coverage is 37.21%; the guard is unit-tested but route-level
   negative-path coverage (e.g. proxy/no-key flows) remains thin.

---
**API Tester**: independent re-verification, iteration 2 post-remediation
**Commit**: 1435e2a
**Date**: 2026-10-20
**Quality status**: PASS (Gate 1 PASS, Gate 2 PASS)
**Release readiness**: Go for the H-1 / M-1 / L-1 remediation scope; observations above are
non-blocking hardening items.
