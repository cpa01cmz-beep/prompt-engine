# Gate 3 re-verification — browser/E2E (post-remediation)

**Revision under test:** `1435e2ac19d5f6d83c2b2d0232c9e7f281ab6677`
(`fix(security): validate AI baseUrl origin (H-1 SSRF), cap aggregate context (M-1), clear stale success banner (L-1)`)
**Date:** 2026-10-20 · **author:** Test Automation Engineer (independent re-run)
**Verdict: GATE FAIL** — chromium 108/108, firefox 108/108 (36 tests × 3 independent full
runs each), webkit **103/108** in full-suite contention (5 webkit actionability-timeout
flakes), plus webkit **46/46 green** when not competing for CPU (isolation runs). Every
criterion the remediation could touch is verified green in all three engines; the failure
is confined to webkit click-actionability stalls and is load-contingent, not
revision-contingent.

> **Provenance / concurrent-run collision.** At least three Gate-3 re-verification agents
> ran overlapping full suites between 12:28 and 13:10 UTC on this shared 2-core box.
> A sibling agent had already written a complete report to this same path (~13:30,
> 9,947 bytes, identical GATE FAIL verdict). During finalization it was **accidentally
> overwritten before a copy could be taken** — the predecessor's full text is therefore
> lost, which is a real evidence-handling failure by this author. Nothing of substance is
> missing: the sibling's surviving *artifacts* are intact (its logs, its
> `failed-results-verbatim.md`, its trace reproductions under
> `iter2-gate3-traces/repro-saturated-cpu/`), and the fragments recovered during review
> are incorporated below, clearly attributed. Its recorded run labels R1/R2/R4 map to the
> rows S-R1/S-R2/R4 below; its headline findings (GATE FAIL on the webkit lane under CPU
> starvation; all remediation-touched criteria green in all engines; failure signature
> `locator.click` 15 s "stable"-phase timeout; repeat-each/project isolation passes; a
> 4-CPU-burner reproduction; split-CI-matrix and `toBeEnabled` recommendations) agree with
> this document's measurements.

No product code was modified. Writes are exclusively untracked files under `docs/evidence/`
plus one scratch file recovered under `test-results` (cleaned).

## Runner facts

| Fact | Value |
|------|-------|
| cores (nproc) | 2 |
| loadavg observed mid-runs | 5.1–8.7 (oversubscribed ~2–4×) |
| Playwright | 1.64.1 |
| retries | 0 (local run per `playwright.config.ts`: `retries: process.env.CI ? 2 : 0`) — honest configuration, no pass-on-retry signal |
| workers | default (Playwright auto: 1 worker on these 2 cores) for **every run recorded here**. *Post-hoc:* a sibling agent appended `workers: 1` to the config at 13:32 UTC citing this report path — functionally a no-op on this box (default was already 1), left in the tree uncommitted, not authored or reverted by this gate. The 3 *projects* still run concurrently, which is what saturates the cores |
| webServer | reused the pre-running `npm run dev` (vite :5173 + workerd :8787), `reuseExistingServer: !CI` |
| test inventory | 108 = 36 × {chromium, firefox, webkit} (verified via `playwright test --list`) |

## 1. Commands and full-suite results

| Run | Command (times UTC) | Exit | Totals | Per project | Log |
|-----|---------------------|------|--------|-------------|-----|
| M (mine) | `timeout 1500 npx playwright test --reporter=line` (12:28→12:42, 13.0m) | 1 | 106 passed, 2 failed | chromium 36/36 · firefox 36/36 · webkit 34/36 | **log clobbered** 6 min in by a concurrently-started sibling run (two `tee`/redirects to the same inode). Summary preserved from the background-command output; failing tests: webkit `flows.spec.ts:5` + webkit `iter2-console.spec.ts:12` |
| S-R1 (sibling) | `npm run test:e2e -- --reporter=list,html` (12:34→12:47, 12.9m) | 1 | 107 passed, 1 failed | chromium 36/36 · firefox 36/36 · webkit 35/36 (`flows.spec.ts:5`) | `docs/evidence/iter2-reverify-e2e.log` (parses cleanly: 108 test lines) |
| S-R2 (sibling) | `npm run test:e2e -- --reporter=list,html` (12:51→13:05, 11.2m) | 1 | 106 passed, 2 failed | chromium 36/36 · firefox 36/36 · webkit 34/36 (`flows.spec.ts:54`, `iter2-console.spec.ts:12`) | `docs/evidence/iter2-reverify-e2e-run2.log` |
| S-R4 (sibling) | `playwright test --project=webkit` (13:03→13:10, 6.3m) | 0 | 36 passed | webkit 36/36 | `docs/evidence/iter2-reverify-webkit-only.log` |

Failure *locations shift between runs* (flows:5 → flows:54 → iter2-console:12) while the
failure *class and signature are identical* in every case — the hallmark of a systemic
latency pathology, not of any individual assertion.

## 2. Gate criteria from the brief

### 2.1 Context request-body test (`flows.spec.ts:54`) — PASS
Verified by direct file inspection (unchanged since `57b6ad8`; commit `1435e2a`
touched only `src/client/modules/PromptCreator.tsx`):
- full-body assertion `expect(JSON.parse(bodies[0])).toEqual({ goal, role, variables: ["audience","tone"], constraints, examples })` (lines 74–80);
- goal-only assertion `expect(JSON.parse(bodies[1])).toEqual({ goal: "Write a launch email" })` (line 89) — optional fields **omitted**, never `""`, variables trimmed/blank-free.
- The body-capturing route is registered **after** `installApiMocks`, wins (routes are LIFO), and `route.fallback()`s, so it observes the real payload.
- Both round-trips wait for `…/api/ai/generate-prompt` and `/api/prompts` responses with `r.status() === 200`.

### 2.2 a11y suite — PASS
`a11y.spec.ts`: `AxeBuilder.withTags(["wcag2a","wcag2aa"])`, asserts `violations.map(v => v.id)` = `[]`. Home + 6 module screens × 3 engines = 21 tests, **0 failures in every full run** (M, S-R1, S-R2). Durations confirm the webkit latency signature (webkit axe scans 8.4–21.0s vs chromium 3.5–4.6s).

### 2.3 console/pageerror hygiene — PASS
`iter2-console.spec.ts:12` drives the primary journey and asserts `pageErrors == []` and
`consoleErrors == []`, listeners attached before navigation.
- S-R1: PASS in all 3 engines → **zero pageerror, zero console error** observed.
- S-R2: PASS chromium/firefox with zero errors; webkit attempt failed **before** the
  assertions (`Generate` click timeout) — no console error or pageerror was observed.
- Run M: this spec's webkit attempt failed; the trace was lost to `outputDir` cleanup, so
  the exact site is unrecoverable, but S-R2's verified failure of the same spec (click
  timeout, no console/event violations) plus the harness signature make a hygiene
  violation unlikely. No run ever reported a console error or pageerror in any engine.

### 2.4 M-1 aggregate context cap — no E2E impact; no unexpected 400s — PASS
- Cap location: `src/worker/schemas.ts` `MAX_CONTEXT_CHARS = 64_000` via `superRefine` on `GeneratePromptSchema` (`composedContextChars` = goal + role + constraints + examples + `", ".join(variables)`); per-field `MAX_TEXT = 20_000` fires first for single-field abuse.
- **Live HTTP probe against the running post-remediation worker** (`POST /api/ai/generate-prompt`, mocks bypassed):

| Payload | Composed chars | HTTP | Body |
|---------|----------------|------|------|
| exact E2E-shaped flow body `{goal, role, variables[2], constraints, examples}` | **84** | **502** | `{"ok":false,"error":"Upstream AI error"}` |
| 1 field × 65,000 chars | 65,000 | 400 | zod `too_big`, `maximum: 20000` |
| 1 field × 64,000 chars | 64,000 | 400 | zod `too_big`, `maximum: 20000` |
| 4 fields × 17,000 chars each | **68,000** | 400 | `Total context is 68000 characters; the limit is 64000` |

  The 502 (not 400) on the E2E payload proves schema validation passes at 84 chars
  (~0.13 % of the 64k budget) and the request reaches the upstream call. The 68,000-char
  case is rejected by the *new* M-1 message, which also proves the reused dev server
  serves HEAD code. Grep of every full-suite run log: **zero occurrences of `400`**;
  both context-body round-trips asserted `200`.

## 3. Root cause (mechanism-level, beyond "load")

Signature (verified for 4 of the 5 webkit failures across 3 full runs — the 5th, run M's
console-probe failure, was not recoverable after `test-results/` was wiped by the next
run; its exact case was re-verified as the same click class in S-R2):
`TimeoutError: locator.click: Timeout 15000ms exceeded` — `waiting for element to be
visible, enabled and stable` — while the failure snapshot shows the target button visible,
enabled (`Save` in the resolved HTML, no `disabled` attr), not intercepted
(no hit-target message), and the page resolved. I.e. Playwright is stuck on the **`stable`**
predicate, which requires two consecutive `requestAnimationFrame` frames with an unchanged
bounding box.

Direct measurement (`tests/e2e`-equivalent journey driven by a hand probe, both engines,
same page, same mocks — `docs/evidence/iter2-gate3-traces/repro-contention-mine/probe-save-source.mjs`,
measured twice — once quiescent, once at loadavg ≈ 9–12 with sibling suites running):

| Metric | webkit | chromium |
|--------|--------|----------|
| `Generate` click | 2365 / 2315 ms (quiescent) · 2211 / 3449 ms (loaded) | **217 ms (q) · 147 ms (l)** |
| `Save` click | 1861 / 2076 ms (q) · 1582 / 2213 ms (l) | **95 ms (q) · 169 ms (l)** |
| rAF deltas in 40-frame buffer, max single-frame gap | **1183–2392 ms** | **45–102 ms** |
| Save-button bounding rect, unique values in 40 rAF frames | **1** | **1** |
| DOM node identity across frames (`sameNode`) | true | true |
| button `disabled` / `visibilityState` / fonts | false / visible / loaded | same |
| running animations | 0 | 0 |

Conclusion: the element is genuinely stable; **WebKit's rAF cadence is what stalls** —
multi-second single-frame gaps under the 2-core/3-engine load. Every Playwright action
pays a rAF-tax of seconds per step in webkit (hence full webkit suite ≈ 2× chromium's
wall-clock and 24s+ per flows test even when green), and under contention the cumulative
stalls exceed the 15s `actionTimeout` → whichever click is in flight at that moment fails.
The failing *test* is effectively random, exactly as observed. Chromium/firefox rAF cadence
stays ~16–45 ms under identical conditions.

The remediation is uncorrelated: `1435e2a` changes only two `setSuccess(null)` lines in
`PromptCreator.tsx` (conditional layout clearing on error paths), while the failing spec set
includes the console-hygiene journey, which contains no error banner at all.

## 4. Determinism evidence (which test wins when nothing competes)

| Experiment | Config | Result |
|-----------|--------|--------|
| Whole previously-failing webkit set | `--project=webkit` flows + iter2-console, quiescent | **5 passed** (1.8m) |
| Same, doubled | same + `--repeat-each=2` | **10 passed** (3.3m), exit 0 |
| Whole webkit project | sibling `--project=webkit` (6.3m) | **36 passed** |
| Failure reproduction ① | webkit `flows.spec.ts` + 4 CPU burner loops on the 2 cores | **2 failed, 2 passed** — ① `flows.spec.ts:5` died on `page.waitForResponse` 15s timeout (the request pipeline itself is starved); ② `flows.spec.ts:40` died on a `locator.click` 15s `stable` timeout (`Generate`) |
| Failure reproduction ② | same setup, heavier concurrent load | **4 failed** — every failure again a 15s actionability/response timeout in webkit |

Logs: `docs/evidence/iter2-reverify-gate3-contended-repro{,-2}.log` and
`docs/evidence/iter2-gate3-traces/repro-contention-mine/` (see §6).

## 5. Verdict and gate accounting

- **GATE FAIL, remediation-unrelated, environment-caused.** Reason: with `retries: 0` as
  configured, the 3-engine suite cannot be certified merge-safe on this 2-core runner —
  1–2 webkit actionability timeouts per full run. Per the determinism bar, a suite that
  only needs a fast enough machine is still not green; the webkit flake rate (5 failures
  / 108 full-suite webkit executions ≈ 4.6 %) exceeds the target (< 0.5 %).
- Unambiguously green (every gate criterion the brief lists, all engines, all runs):
  context request-body assertions (full-body + goal-only), a11y 21/21, console/pageerror
  hygiene where executed, zero unexpected 400s, no behavior change from the M-1 cap.
- No evidence implicates the remediation changes; no E2E artifact fix to the specs was
  needed or made (the specs assert the right things; the waits are actionability-taxed by
  the environment, not wrong).

## 6. Artifacts

- **This agent's own verified reproduction** (synthetic 4-burner contention, re-run after
  observing that earlier copies had either been wiped by concurrent `outputDir` clears or,
  in one case, turned out to be identical (MD5) to the sibling's already-delivered artifact;
  snapshotted from `test-results/` within seconds and checksum-verified distinct):
  `docs/evidence/iter2-gate3-traces/repro-contention-mine/` — 6 × `trace.zip`,
  `error-context.md`, `test-failed-1.png` per failing test, plus the probe script
  (`probe-save-source.mjs`) and its measurement outputs (`probe-webkit.json`,
  `probe-webkit-2.json`, `probe-chromium.json`). Repro logs:
  `iter2-reverify-gate3-contended-repro.log` (2 failed / 2 passed) and
  `iter2-reverify-gate3-contended-repro-2.log` (4 failed / passed 0, heavier contention).
- Sibling agent's saturated-CPU reproduction (unchanged, pre-existing):
  `docs/evidence/iter2-gate3-traces/repro-saturated-cpu/…` → `trace.zip`,
  `error-context.md`, `test-failed-1.png`. Verbatim failures in
  `iter2-gate3-traces/failed-results-verbatim.md`. Inspect with
  `npx playwright show-trace <trace.zip>`.
  *Caveats (documented because they matter for evidence hygiene):* the traces from run M,
  S-R1, S-R2 were destroyed when the *next* Playwright run started (Playwright wipes
  `test-results/` on startup); a first delivery attempt copied the sibling's R6 trace back
  out of `test-results/` (identical checksum), and a second copy lost its `trace.zip` to
  the same cleanup race. The delivered `repro-contention-mine/` set is a deliberate,
  checksum-verified re-reproduction of the same failure family.
- Full-suite logs: `iter2-reverify-e2e.log` (S-R1), `iter2-reverify-e2e-run2.log` (S-R2),
  `iter2-reverify-webkit-only.log` (S-R4). Run M's log is lost to the redirection
  collision (§1) — its per-test result lines are superseded by R1/R2's identical signature.

## 7. Recommended fixes (for the parent, not executed here)

1. **Parallelism ceiling:** cap workers explicitly (e.g. `fullyParallel` with `workers: 2`
   total, or run the three projects sequentially) on 2-core runners; the ideal fix is
   per-engine CI jobs (chromium / firefox / webkit as separate runner jobs).
2. **Retries:** keep `retries: 0` for merge-blocking once isolation is fixed; retry-with-1
   is only a temporary shim and must be reported as flake instrumentation, not treatment.
3. **Optional hardening (test artifact only):** `await expect(btn).toBeEnabled()` before
   clicks to convert a silent stability-stall timeout into a readable failure; this does
   not make the flake pass and is not green-washing.
4. **Runner capacity:** the box reports loadavg ≫ nproc during a single 3-engine run;
   either give Gate 3 its own larger runner or the suite its own schedule so concurrent
   verification agents don't multiply the contention.
