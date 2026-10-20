# AGENTS.md — src/worker/routes

## Scope
One Hono sub-app per feature, mounted in `../index.ts` under `/api`: `health`, `prompts`, `templates`, `skills`, `evaluations`, `settings`, `ai`, `auth`, `search`.

## Rules
- Validate every body/query with Zod schemas from `../schemas`; bounds live there (also `MAX_CONTEXT_CHARS`).
- Outbound calls only after `resolveBaseUrl`-style trust checks: `routes/ai.ts` validates caller-supplied baseUrl (non-public/non-HTTPS → 400; untrusted origin without a caller key → 403; env key attached only to trusted origins).
- All responses use the envelope; errors from upstream go through `../lib/outboundError.mapOutboundError`.
- Changing a route shape? Update `docs/api.md` (local) and e2e specs in `tests/e2e` in the same change.

## Verification
`npm run test:unit` (`ai-baseurl-guard.test.ts` covers the baseUrl guard) and `npm run test:integration` (`smoke.test.ts` walks routes through the real app wiring).
