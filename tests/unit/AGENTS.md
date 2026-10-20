# AGENTS.md — tests/unit

## Scope
Vitest unit tests (jsdom, globals, setup injects `@testing-library/jest-dom`), run with `npm run test:unit` (config: `vitest.config.ts`, also matches tests colocated under `src/`).
Current files map to worker contracts: `outboundError.test.ts` (error-boundary contract), `modelJson.test.ts`, `schemas.test.ts`, `rateLimit.test.ts`, `ai.test.ts` (config/trust), `ai-baseurl-guard.test.ts` (SSRF guard), `ai-composition.test.ts`, `ai-json.test.ts`, `hardening.test.ts` (`isPublicHttpsUrl`, `parseAiProvider`, db utils).

## Rules
- Unit imports run against real worker modules directly (`import app from "../../src/worker/index"` or specific modules) — no server, no D1.
- Config-bearing tests mock `Env` inline (`import type { Env } from "../../src/worker/env"`).
- One file per behavioral contract; when you change a helper in `src/worker/lib`, its test lives here.
