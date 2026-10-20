# Verification: backend hardening 355c36b — 2026-10-20

## Live local server (`npx wrangler dev --local --port 8788`)

| Check | Result |
|---|---|
| PUT /api/settings/ai.provider valid (opencode.ai zen v1, deepseek-v4.1-flash-free) | 200 ✅ |
| PUT baseUrl http://evil.com | 400 ✅ |
| PUT baseUrl https://localhost/v1 | 400 ✅ |
| PUT baseUrl https://10.0.0.5/v1 | 400 ✅ |
| PUT baseUrl https://192.168.1.20/v1 | 400 ✅ |
| PUT baseUrl https://169.254.169.254/... (SSRF/metadata) | 400 ✅ |
| PUT baseUrl https://api.openai.com/v1 | 400 ✅ (after fix, see below) |
| PUT /api/settings/OPENAI_BASE_URL | 400 "Key not allowed" ✅ |
| PUT {} (missing value) | 400 ✅ |
| PUT invalid JSON | 400 "Invalid JSON body" ✅ |
| GET /api/api-nonexistent | 404 JSON "Not found" ✅ |
| GET /api/health | 200 ✅ |
| POST /api/ai/chat | 500 JSON (caught upstream 403 FreeTierError — sane error, no crash) ✅ |

## Finding + fix
355c36b accepted any public `https://` baseUrl for `ai.provider`, including
`https://api.openai.com` — contrary to the audit requirement that the
user-writable provider override may only target operator-trusted origins.
While no secrets are attached to untrusted hosts, the redirect target was
still attacker-influenced.

Fix: `parseAiProvider` now also requires the target origin to be trusted —
the `OPENAI_BASE_URL` env origin, plus optional comma-separated extra origins
via new `AI_PROVIDER_ALLOWLIST` env (bare hostnames allowed). Applied at both
write (settings PUT 400) and read (`getAiConfig` falls back to trusted env
config when the stored setting fails) time.

## Quality gates (after fix)

| Gate | Result |
|---|---|
| npm run test:unit | PASS (4 files, 18 tests) |
| npm run test:integration | PASS (1 file, 3 tests) |
| npm run typecheck | PASS (0 errors) |
| npm run lint | PASS (0 errors) |
| npm run build | PASS |

Note: wrangler dev hot-reload occasionally enounters a transient local
`SQLITE_BUSY` on the D1 file when multiple reloads race; restarting the dev
process clears it (tooling, not code).
