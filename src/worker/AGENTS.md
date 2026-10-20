# AGENTS.md — src/worker

## Scope
Cloudflare Worker (Hono), entry `index.ts`: wires middleware, then all 9 feature routes. Typed bindings/env in `env.ts` (`DB` D1, `CACHE` KV, `ASSETS`, `OPENAI_*`, optional `AI_PROVIDER_ALLOWLIST`). Zod payload bounds in `schemas.ts` (TEXT ≤ 20 000, TITLE ≤ 300, SEARCH ≤ 500, arrays ≤ 50, JSON ≤ 32 KB, `MAX_CONTEXT_CHARS` 64 000).

## Rules
- Middleware order is fixed: `securityHeaders` → `corsMiddleware` → `rateLimitMiddleware`, applied `app.use("*", …)` before routes.
- Every route returns the envelope `{ ok: true, data }` | `{ ok: false, error }` and validates bodies with schemas from `./schemas`.
- Never surface upstream error bodies — return via `lib/outboundError.mapOutboundError` in catch blocks.
- All D1 access goes through `db/*`, never inline SQL in routes.

## Verification
`npm run typecheck` (`tsconfig.worker.json` project), `npm run test:unit`, `npm run test:integration` (loads this app in-process).
