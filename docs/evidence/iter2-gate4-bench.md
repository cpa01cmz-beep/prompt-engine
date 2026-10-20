# Gate 4 — Performance bench (iteration 2, context-aware generation)

- Date: 2026-10-20 (UTC)
- HEAD: `57b6ad8` — `feat(automation+ux): context-aware prompt generation; grouped navigation with primary journey CTA; single-flow PromptCreator; E2E request-body test`
- Command: `npm run build` (vite 6.4.4) → `docs/evidence/iter2-gate4-build.log` (exit 0, 3.45 s, 47 modules)

## Bundle size (dist/client)

| Artifact | Raw bytes | Raw kB | Vite gzip | Independent `gzip -9` |
|---|---|---|---|---|
| `assets/index-r3xEC1Nv.js` | 187,766 | 187.77 | 56.12 kB | 55,967 B |
| `assets/index-DlHVmJeh.css` | 37,249 | 37.25 | 7.27 kB | 7,239 B |
| `index.html` | 410 | 0.40 | 0.27 kB | — |

## Delta vs pre-iteration baseline

Baseline = `docs/evidence/build.log` (2026-10-20T04:21, before the 10:53Z iteration commit):

| Artifact | Baseline raw | Now raw | Δ raw | Baseline gzip | Now gzip | Δ gzip |
|---|---|---|---|---|---|---|
| JS | 180.72 kB | 187.77 kB | **+7.05 kB (+3.90 %)** | 54.64 kB | 56.12 kB | **+1.48 kB (+2.71 %)** |
| CSS | 34.62 kB | 37.25 kB | **+2.63 kB (+7.60 %)** | 6.99 kB | 7.27 kB | **+0.28 kB (+4.01 %)** |

Interpretation: the delta is consistent with the two UI changes in this iteration (grouped navigation metadata + collapsible context fieldset); no icon/animation dependency was added. Older `docs/evidence/baseline-build.log` (146.64 kB JS) reflects the pre-design-system baseline and is **not** the comparison point for this iteration.

## Dependency delta

- `git diff --stat 57b6ad8^ 57b6ad8 -- package.json package-lock.json` → empty. **No dependency added, removed, or upgraded.**
- `@vitest/coverage-v8` used by Gates 1–2 was installed with `--no-save`; it is absent from `package.json` (grep count 0) and from the lockfile diff.

## Runtime/complexity sanity

- `composeGenerationUserMessage` (`src/worker/services/ai.ts:160-168`): one linear pass over ≤ 5 sections + one `Array.prototype.join` over ≤ 50 variables → **O(total context characters)**, no nesting, no regex, no I/O. Bounded above by schema (50 × 20,000 = 1,000,000 chars worst case, see Gate-4 report finding M-1).
- `buildCreatePromptMessages` returns a constant 2-message array for every call (goal-only and context paths share shape) — no per-call allocation growth.
- Generation path adds **zero** extra network round-trips: context is appended to the existing user message (`services/ai.ts:160-181`), so upstream latency is unchanged apart from token count.
- No dev-server latency harness was run (no long-running processes started); build + unit timings only.

## Test timings (same host)

| Run | Result | Duration |
|---|---|---|
| `npx vitest run tests/unit/outboundError.test.ts tests/unit/rateLimit.test.ts tests/unit/ai.test.ts` | 3 files / 15 tests pass, exit 0 | 3.92 s |
| `npm run test:unit` | 8 files / 52 tests pass, exit 0 | — |
| `npm run test:integration` | 1 file / 3 tests pass, exit 0 | — |
