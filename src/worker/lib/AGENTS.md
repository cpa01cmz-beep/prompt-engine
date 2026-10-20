# AGENTS.md — src/worker/lib

## Scope
Shared hardening helpers:
- `outboundError.ts` — `mapOutboundError(c, cause)`: THE error-boundary for upstream failures; returns generic 500/502 envelopes and never leaks the cause to the client.
- `fetchTimeout.ts` — `fetchWithTimeout` + `DEFAULT_FETCH_TIMEOUT_MS` = 30 000 (all outbound fetches must use it).
- `url.ts` — `isPublicHttpsUrl(value)`: SSRF guard (rejects non-HTTPS, private/loopback/localhost).
- `modelJson.ts` — `parseModelJson(schema, text, fallback)`: tolerant parse of AI-returned JSON into a Zod type.
- `validate.ts` — `isNonEmptyString`, `parseJsonBody`.

## Rules
- Use these helpers instead of reimplementing; if you change behavior, `tests/unit/outboundError.test.ts`, `modelJson.test.ts`, `hardening.test.ts` define the contract and must be updated together.
