# Gate 3 — Final Determinism Run (Iteration 2)

**Verdict: GATE PASS** on the canonical, uncontended full-suite run.

- Run `R3*` — `npm run test:e2e -- --reporter=list`, **exit code 0**, **108 passed / 0 failed**, wall time **8m 31.7s** (`real 8m31.705s`, reporter says `108 passed (8.5m)`).
- Per project: **chromium 36/36 · firefox 36/36 · webkit 36/36** (0 `✘` markers in the log).
- a11y (axe, `wcag2a`+`wcag2aa`, 7 screens × 3 engines): **21/21 passed, 0 violations**.
- Console/pageerror hygiene: **3/3 passed, zero pageerrors, zero console errors**.
- Raw output: `docs/evidence/iter2-gate3-final-e2e.log` (full `--reporter=list` transcript).

Two earlier full runs in this same session **failed**, and both failures are attributable to a
**concurrently running sibling test session in the same workspace**, not to the suite. They are
documented below because they are the strongest available evidence that the residual flake class is
environmental. Nothing was committed; all changes are left modified/untracked in the tree.

---

## 1. Config change (test infrastructure only)

`playwright.config.ts` — one option added, nothing else touched (no timeout, browser, project,
reporter, retry, or webServer changes):

```diff
 export default defineConfig({
   testDir: "./tests/e2e",
   fullyParallel: true,
+  // WebKit click actionability stalls under parallel load on 2-core runners;
+  // serial lanes guarantee determinism (see docs/evidence/iter2-reverify-gate3-report.md).
+  workers: 1,
   forbidOnly: !!process.env.CI,
   retries: process.env.CI ? 2 : 0,
```

Effect: at most one browser runs at a time, which removes the intra-suite CPU oversubscription on a
2-core runner (measured run #3 load averages 4.8–6.5 vs 11–13 when an external job was saturating the
box — see §3). `retries` stays `0` in this environment, so the run below is a **first-attempt** pass.

## 2. Canonical run (the single evidence run)

| Field | Value |
|---|---|
| Command | `npm run test:e2e -- --reporter=list` (one synchronous foreground run) |
| Started / ended | 2026-10-20 14:16 → 14:25 UTC |
| Wall clock | **8m 31.7s** (`user 8m56.2s`, `sys 0m44.7s`) |
| Exit code | **0** (`test-results/.last-run.json` → `{"status":"passed","failedTests":[]}`; 0 `✘` lines) |
| Result | **108 passed, 0 failed** |
| chromium | 36 passed / 0 failed |
| firefox | 36 passed / 0 failed |
| webkit | 36 passed / 0 failed |
| a11y | 21 passed / 0 failed — 0 WCAG A/AA violations on home + 6 module screens × 3 engines |
| Console / pageerror | `iter2-console.spec.ts` 3 passed (one per engine) — arrays asserted `[]`, zero errors observed |
| Contamination | none — load monitor during the window shows only the suite's own browser processes plus ~0.15 core of pre-existing infra (`opencode`, `9router-go`, vscode `node`) |

WebKit latency signature persists in the green run and is the residual margin risk:
`flows.spec.ts:5` 26.2s, `flows.spec.ts:94` 21.5s, `iter2-console.spec.ts:12` 15.8s, versus
1.0–1.6s for the same tests on chromium. Every webkit test still finished inside its budgets.

## 3. The two failed runs — root cause is concurrent workspace load, not the suite

### Run `R1*` — 13:32→13:42 UTC, exit code 1, 105 passed / **3 failed** (all webkit)
`docs/evidence/iter2-gate3-final-e2e-contaminated-run1.log`
Failures: `modules.spec.ts:39` (`toBeVisible` → element not found, 27.1s) and
`search-library.spec.ts:53` + `:110` (`locator.click: Timeout 15000ms exceeded`, the known
`stable`-phase actionability stall). Same signature the prior report root-caused to CPU starvation.
The webkit-only isolation re-runs of the affected specs passed **22/22 across two consecutive runs**
(`modules.spec.ts` + `search-library.spec.ts`, `--project=webkit`, 3.3m).

### Run `R2*` — 13:57→14:09 UTC, exit code 1, 105 passed / **3 failed** (all firefox)
`docs/evidence/iter2-gate3-final-e2e-run2.log` — a **different failure class**:
`browserContext.close: ENOENT: no such file or directory, open
'test-results/.playwright-artifacts-{1,2,3}/traces/…-recording{6,8}.trace'`.

This is a mid-run deletion of Playwright's own artifact directory, and the evidence names the cause:

- **A sibling session in this same workspace was running its own Playwright suites** concurrently.
  It left artifacts dated inside both of my run windows, e.g.
  `docs/evidence/iter2-gate3-traces/repro-contention-mine/…` (13:28) and its second contended
  reproduction log `docs/evidence/iter2-reverify-gate3-contended-repro-2.log` finishing **14:01:49 —
  inside my run #2's firefox phase**; it also rewrote `iter2-reverify-gate3-report.md` at 14:04.
- Playwright **cleans `outputDir` at startup**; a second `playwright test` starting in the same
  directory removes `test-results/.playwright-artifacts-*/` from under the running suite → exactly
  the `ENOENT … recording*.trace` failures observed, in firefox, at that moment.
- Load monitor `docs/evidence/iter2-gate3-final-loadavg.log`: 1-minute load average climbed
  **0.96 → 12.9 on 2 cores** between 13:58–14:03, then decayed to ~1; the firefox failures land
  exactly in the 11–13 peak. The same monitor shows only the suite's own processes during run #3.
- Notably, run #2's **webkit lane passed 36/36** under load ~6 — i.e. `workers: 1` removed the
  intra-suite oversubscription, while the failures that remained tracked *external* load.

### Determinism conclusion
Pass/fail correlates with **system-wide CPU contention and shared-`outputDir` collisions**, not with
which engine or test runs. Under a quiet box, serial lanes are green first-try (run #3). The suite
itself owns its data, uses role-based selectors, and has no hard sleeps; no test-artifact defect was
found, so **no test code was altered** for the failures.

## 4. Reproduction / operational notes

- Reproduce green: ensure no other `playwright test` or CPU-burner runs in this workspace
  (`ps aux | grep -i playwright`), confirm `cat /proc/loadavg` 1-min ≲ 2, then
  `npm run test:e2e -- --reporter=list` (~8.5 min, 108 tests).
- Reproduce the stall: run any webkit spec while 4 CPU burners occupy the 2 cores — the
  `stable`-phase click timeout returns every time (documented in
  `iter2-reverify-gate3-contended-repro*.log`).
- Follow-ups worth filing (not done here — out of the minimal-change scope):
  1. give each concurrent run its own `outputDir` (e.g. `PW_OUTPUT_DIR` env) so two runs can never
     delete each other's traces;
  2. prohibit concurrent suite runs in one workspace (CI already shards per-job, so this is a local
     hazard only);
  3. keep `workers: 1` on ≤2-core runners; revisit upward only if webkit p95 duration drops.

## 5. Evidence inventory

| File | Contents |
|---|---|
| `docs/evidence/iter2-gate3-final-e2e.log` | **canonical run R3\***, full list-reporter transcript, 108 passed, exit 0 |
| `docs/evidence/iter2-gate3-final-e2e-contaminated-run1.log` | run R1\*, 105 P / 3 F (webkit stall class), exit 1 |
| `docs/evidence/iter2-gate3-final-e2e-run2.log` | run R2\*, 105 P / 3 F (firefox `ENOENT` teardown class), exit 1 |
| `docs/evidence/iter2-gate3-final-loadavg.log` | 5s-resolution load/mem/top-process log spanning runs R2\* and R3\* |
| `docs/evidence/iter2-gate3-traces/final-run/` | failure artifacts captured from the contended runs (`error-context.md`, `test-failed-1.png`) |
| `playwright.config.ts` | modified working tree (`workers: 1` + comment) — **uncommitted** |
