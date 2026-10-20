# AGENTS.md — src/client/lib

## Scope
Client data + auth plumbing:
- `api.ts` — `api` singleton: fetch wrapper that injects the Bearer token, sends JSON, unwraps the `ApiResponse<T>` envelope (also re-exports the type).
- `auth.ts` — session token get/set/clear (single place for credential storage).

## Rules
- All HTTP calls go through `api` — no raw `fetch` in components/modules.
- On 401, clear the token and surface the login gate; never log tokens or error bodies.
