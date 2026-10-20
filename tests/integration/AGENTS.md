# AGENTS.md — tests/integration

## Scope
`smoke.test.ts` — imports the whole worker app (`import app from "../../src/worker/index"`) and exercises route wiring in-process with a `mockEnv` (node-vitest, no D1/KV server needed).

## Rules
- Use `app.request(...)` for requests — don't start a network server here; that's Playwright's job in `e2e`.
- Keep the mock env aligned with `src/worker/env.ts`; if a new binding is added to `Env`, extend `mockEnv` or the test will fail closed (e.g. rate limiter returns 503 for mutations).
