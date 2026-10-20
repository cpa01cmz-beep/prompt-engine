# AGENTS.md — src/worker/middleware

## Scope
Three middlewares wired in `../index.ts` in exactly this order (all `app.use("*", …)`):
- `security.ts` — `securityHeaders()`: CSP (`default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `connect-src 'self'`).
- `cors.ts` — `corsMiddleware()`: dev origins localhost/127.0.0.1 on 5173 & 8787 + same-origin; allowed headers `Content-Type`, `Authorization`, `X-Correlation-ID`.
- `rateLimit.ts` — `rateLimitMiddleware()`: KV `CACHE` counters; **fails closed** — mutating requests (POST/PUT/DELETE) return `503 { ok:false, error:"Service temporarily unavailable" }` when `CACHE` is missing.

## Rules
- Don't reorder or bypass these in routes; if a route needs exceptions, discuss via a middleware option, not a skip.
- Contract: `tests/unit/rateLimit.test.ts`.
