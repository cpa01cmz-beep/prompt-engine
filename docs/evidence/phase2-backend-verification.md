# Phase 2 — Backend Core Verification Evidence

Date: 2026-10-20 · Agent: backend Core Developer · Scope: optional prompt-generation context (schema/route/service/client api)

## Commands run (exact, in repo root)

| # | Command | Exit code | Result |
|---|---------|-----------|--------|
| 1 | `npm run typecheck` (`tsc -b`) | 0 | clean — no errors |
| 2 | `npm run lint` (`eslint .`) | 0 | clean — no errors |
| 3 | `npm run test:unit` (`vitest run`) | 0 | **52 passed (52)** — final run: `Test Files  8 passed (8)`, `Tests  52 passed (52)` |
| 4 | `npm run test:integration` (`vitest run --config vitest.integration.config.ts`) | 0 | **3 passed (3)** — `Test Files  1 passed (1)`, `Tests  3 passed (3)` |

## Notes on runs

- First unit-test run: 1 failed / 50 passed. The failing case asserted that a
  whitespace-only goal (`"   "`) is rejected. The spec (specifications.md §5)
  defines `goal: BoundedText.min(1)`, which only rejects empty strings — a
  3-character whitespace string passes the min(1) bound. The test was corrected
  to match the spec exactly (empty rejected; whitespace-only accepted). No
  product code changed; re-run was 52/52 green.
- No commits made; all changes left in working tree as instructed.

## Last lines of each test run (final)

```
npm run test:unit
  Test Files  8 passed (8)
       Tests  52 passed (52)
    Duration  9.06s

npm run test:integration
  Test Files  1 passed (1)
       Tests  3 passed (3)
    Duration  809ms
```

## Files changed (working tree only)

- `src/worker/schemas.ts` — `GeneratePromptSchema` now accepts optional `role`,
  `variables` (array of non-empty strings, max 50), `constraints`, `examples`
  (all `BoundedText`-bounded). Export name preserved.
- `src/worker/services/ai.ts` — `buildCreatePromptMessages(goal, ctx?)` composes
  labeled sections `Role: …`, `Variables: …` (comma-joined), `Constraints: …`,
  `Examples: …` after the goal. Goal-only / all-empty context yields the exact
  previous user message; the 2-message (system+user) shape is unchanged.
  Old single-argument signature still valid.
- `src/worker/routes/ai.ts` — `/generate-prompt` handler passes
  role/variables/constraints/examples from `parsed.data` into the service.
- `src/client/lib/api.ts` — `aiGeneratePrompt(goal, ctx?)` serializes only
  non-empty fields into the POST body (empty keys omitted); `request<T>`
  envelope and auth behavior unchanged; `aiGenerateSkill` untouched.
- `tests/unit/schemas.test.ts` — added GeneratePromptSchema cases: goal-only
  accepted; empty goal rejected; bounds rejected (20,001-char text); all fields
  accepted; >50 variables rejected; exactly 50 accepted; empty-string variable
  entries rejected.
- `tests/unit/ai-composition.test.ts` (new) — labeled-section composition,
  comma-joined variables, empty/undefined ctx goal-only fallback, deterministic
  section order, message-shape parity with goal-only call.

## Deviations from spec

- Extra unknown keys are NOT rejected: existing schemas use plain `z.object`
  (non-strict) throughout; per instructions the schema matches existing style.
- Whitespace-only goal is accepted (not rejected) because the spec pins
  `BoundedText.min(1)` exactly; test asserts spec-true behavior.

## Gates

| Gate | Requirement | Status |
|------|-------------|--------|
| Gate 1 (unit) | F-1..F-4 context schema/service composition, empty-context fallback | Pass |
| Gate 2 (integration) | NF-3 `{ok,data,error}` envelope + zod bounds unchanged | Pass (3/3) |
