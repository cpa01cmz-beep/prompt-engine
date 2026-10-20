# Evidence — AI prompt enrichment + context-limit raise (2026-10-20)

## Change
- `src/worker/services/ai.ts`: all 10 `build*Messages` system prompts rewritten with rubrics, output-shape specs, and "JSON only" directives; `chatCompletion` gained `jsonMode` option (`response_format: { type: "json_object" }`); `chatCompletionJSON` always opts in and retries once without `response_format` on upstream HTTP 400 (providers that reject it); `CHAT_TIMEOUT_MS` 30 000 → 120 000 (slow self-hosted providers) and default `max_tokens` 1 200 → 8 128 so long generated prompts and large JSON responses are not truncated. The `/api/ai/test` connection probe keeps its tiny budgets (1 200 / 5) on purpose.
- `src/worker/schemas.ts`: `MAX_TEXT` 20 000 → 50 000; `MAX_CONTEXT_CHARS` 64 000 → 200 000. Aggregate cap still binds the worst legal case (≈2.7 MB composed). Aggregate-cap error message now contains `200000`.
- Docs and AGENTS bounds updated (`AGENTS.md`, `src/worker/AGENTS.md`, `docs/api.md`, `docs/architecture.md`); `docs/evidence/iter2-*` audit records intentionally untouched.

## Gates
| Gate | Result | Command |
|---|---|---|
| lint | 0 errors (3 pre-existing warnings from generated `coverage/`) | `npm run lint` |
| typecheck | pass | `npm run typecheck` (`tsc -b`, clean) |
| build | pass (built in ~1.9 s) | `npm run build` |
| unit | 75/75 in 9 files | `npm run test:unit` |
| integration | 3/3 in-process app | `npm run test:integration` |

## Test deltas
- `tests/unit/schemas.test.ts` rebalanced for the new caps: boundary tests now pin 200 000 exactly (accepted) / 200 001 (rejected), a regression pair proves the variable separator counts toward the total, per-field probes moved to 50 001, aggregate-exceeds message asserted to contain `200000`.
- `ai-composition.test.ts` unchanged and green — user-message composition (`goal\nRole: …`) is still byte-identical; only system prompts changed.
