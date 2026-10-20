# Iteration 2 — Gate 3 report (E2E × 3 browsers + a11y + console hygiene)

**Date:** 2026-10-20
**Owner:** test-automation-engineer (QA)
**Gate definition** (`docs/orchestration_progress.md` §5, Gate 3 rows):
> `E2E 0 failures × chromium/firefox/webkit` · `no unhandled console/pageerror in traced runs`
**Spec reference:** `docs/specifications.md` §4/§8 (NF-3 envelope untouched; §8 item 5:
"`npm run test:e2e` 0 failures across chromium/firefox/webkit; axe scan no
serious/critical violations; no uncaught page errors.")

## Verdict

| Gate 3 condition | Result | Verdict |
|---|---|---|
| E2E 0 failures × chromium | 36/36 passed, exit 0 | ✅ PASS |
| E2E 0 failures × firefox | 36/36 passed, exit 0 | ✅ PASS |
| E2E 0 failures × webkit | 36/36 passed, exit 0 | ✅ PASS |
| axe (WCAG 2.0/2.1 A+AA) no violations | 21/21 a11y tests passed, 0 violations | ✅ PASS |
| no uncaught console/pageerror | 0 pageerror, 0 console.error across the journey | ✅ PASS |

**GATE 3: PASS**

## Commands & exit codes

| # | Command | Exit | Evidence |
|---|---|---|---|
| 1 | `npm run test:e2e` | **0** | `docs/evidence/iter2-gate3-e2e.log` |
| 2 | `npx playwright test --project=chromium` | 0 | per-project isolation re-check |
| 3 | `npx playwright test --project=firefox` | 0 | per-project isolation re-check |
| 4 | `npx playwright test --project=webkit` | 0 | per-project isolation re-check |
| 5 | `npx playwright test tests/e2e/iter2-console.spec.ts --project=chromium` | **0** | `docs/evidence/iter2-gate3-console.log` |
| 6 | `npx playwright test tests/e2e/flows.spec.ts:54 --project=chromium` (pre/post-fix repro) | 1 → 0 | `docs/evidence/iter2-gate3-failures.md` |

Suite command output tail:

```
  108 passed (8.0m)
```

`playwright.config.ts`: `retries: 0` locally, `trace: retain-on-failure`,
`screenshot: only-on-failure`, `forbidOnly` under CI, `webServer: npm run dev`
auto-started on `http://localhost:5173`. **No retries were needed** — every test
passed on its first attempt, so there is no pass-on-retry (flake signal) in this run.

## Totals

| Metric | Value |
|---|---|
| Test files | 6 (`a11y`, `flows`, `home`, `modules`, `search-library`, `iter2-console`) |
| Distinct test cases | 36 |
| Total executions (3 projects) | **108** |
| Passed | **108** |
| Failed | **0** |
| Flaky / pass-on-retry | **0** |
| Wall clock | 8.0m (105-test pre-console run: 9.0m) |

## Per-project breakdown

| Browser project | Tests | Passed | Failed | Exit |
|---|---|---|---|---|
| chromium (Desktop Chrome) | 36 | 36 | 0 | 0 |
| firefox (Desktop Firefox) | 36 | 36 | 0 | 0 |
| webkit (Desktop Safari) | 36 | 36 | 0 | 0 |
| **Total** | **108** | **108** | **0** | **0** |

Per-project test-case composition (`--list`, identical for all 3 projects):

| Spec | Cases | Covers |
|---|---|---|
| `home.spec.ts` | 2 | app shell, engine switching + module reset |
| `flows.spec.ts` | 4 | generate→save→optimize, error-wins-over-stale-success, context payload contract |
| `modules.spec.ts` | 14 | module navigation and per-module create/read/update/delete paths |
| `search-library.spec.ts` | 8 | web search, prompt library, load/save failure surfacing and recovery |
| `a11y.spec.ts` | 7 | axe WCAG A/AA scans (home + 3 prompt + 3 skill screens) |
| `iter2-console.spec.ts` | 1 | end-to-end journey console/pageerror hygiene |
| **Total** | **36** | |

## Accessibility (axe-core)

`tests/e2e/a11y.spec.ts` ran inside the same matrix (no separate config needed) —
**21 executions, 21 passed** (7 screens × 3 browsers):

- home screen
- prompt engine: Library, Templates, Compare
- skills engine: Search, Lab, Creator

Each screen is scanned with `AxeBuilder.withTags(["wcag2a","wcag2aa"])` and the spec
asserts `violations` is empty, printing per-node targets on failure. **Zero
violations** on all 7 screens in all 3 engines/browsers — stronger than the gate's
"no serious/critical" bar.

## Console / page error hygiene

New probe `tests/e2e/iter2-console.spec.ts` (chromium) attaches `page.on("pageerror")`
and `page.on("console")` **before** navigation, then walks the primary journey:
`/` → primary CTA **"Start creating a prompt"** → expand **"Add context"** → fill
Goal / Role / Variables / Constraints / Examples → **Generate** (API mocked via the
shared helpers) → assert Result = `Generated prompt content`.

Result: **0 `pageerror` events, 0 `console.error` calls**, test passed in 1.8s.
Because listeners are installed pre-`goto`, hydration-time errors are covered too.

## Failure found and dispositioned

Initial run: **3 failed / 102 passed** — the same test in all three projects
(`flows.spec.ts:54`, context-payload assertion).

- **Cause: test artifact, not product behavior.** Playwright routes are LIFO; the
  spec registered its observing route before `installApiMocks()` added the
  `**/api/**` catch-all, so the observer never ran and `bodies[0]` was `undefined`.
- **Product verified correct** from the retained trace: the app sent exactly
  `{"goal":"Write a launch email","role":"senior marketer","variables":["audience","tone"],"constraints":"Under 200 words","examples":"Example launch email"}`
  — variables trimmed and blank-free, no empty keys — matching the expectation.
- **Fix (test file only):** register the observer after `openPromptCreator()`. No
  product code touched. Assertions unchanged in strength.
- Full detail + verbatim error lines + repro: `docs/evidence/iter2-gate3-failures.md`.
- Trace preserved: `docs/evidence/iter2-gate3-traces/chromium-context-fields/`.

## Working-tree changes made by QA

| File | Type | Note |
|---|---|---|
| `tests/e2e/iter2-console.spec.ts` | new | console/pageerror hygiene probe (required by Gate 3) |
| `tests/e2e/flows.spec.ts` | edit | route registration order fix, test-only |

**No `src/` or worker file was modified.** `docs/evidence/*` is gitignored, so the
logs/report/traces stay as local gate evidence per project convention.

## Residual risk / follow-ups (non-blocking)

1. `installApiMocks`' `**/api/**` catch-all can shadow per-test observers registered
   earlier; converting it to a fixture that installs first would remove this class of
   harness bug entirely.
2. `search-library`/`flows` use `page.waitForResponse` for the money-path round-trips;
   that is condition-based (good). Suite contains **zero** `waitForTimeout` calls.
3. Gate 3 currently proves journeys against mocked `/api/**`. Real worker contract is
   covered by Gate 2 integration tests (NF-3 `{ok,data,error}` shape), so the split is
   intentional — but no test crosses both layers end-to-end yet (tracked as future work).
