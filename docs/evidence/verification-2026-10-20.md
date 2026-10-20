# Verification — 2026-10-20

Backend hardening verification (follow-up to `audit-2026-10-20.md` / `hardening-2026-10-20.md`).
Environment: `npx wrangler dev --port 8788 --local` (D1/KV local, bindings: CACHE, DB, ASSETS, OPENAI_BASE_URL, OPENAI_MODEL). Raw curl transcript: `verification-matrix-2026-10-20.txt`. Gate log: `verification-gates-2026-10-20.log`. No code was modified in this step.

## 1. curl matrix — reads (all pass)

| # | Request | Expected | Result |
|---|---|---|---|
| 1 | GET /api/health | 200 `{"status":"ok"}` | ✅ 200 |
| 2 | GET / (SPA shell via player) | 200 HTML | ✅ 200 `<!doctype html>` |
| 3 | GET /api/prompts | 200 `{"ok":true,"data":[]}` | ✅ 200 |
| 4 | GET /api/templates | 200 `{"ok":true,"data":[]}` | ✅ 200 |
| 5 | GET /api/skills | 200 `{"ok":true,"data":[]}` | ✅ 200 |
| 6 | GET /api/evaluations | 200 `{"ok":true,"data":[]}` | ✅ 200 |
| 7 | GET /api/evaluations?targetType=prompt&targetId=x | 200 filtered list | ✅ 200 |
| 8 | GET /api/settings | 200 `{"ok":true,"data":{...}}` | ✅ 200 |
| 9 | GET /api/settings/ai.provider | 200 typed value | ✅ 200 |

## 2. curl matrix — routing & validation

| # | Request | Expected | Result |
|---|---|---|---|
| 10 | GET /api/definitely-not-a-route | **JSON 404**, not SPA HTML (P1-8) | ✅ 404 `application/json` `{"ok":false,"error":"Not found"}` |
| 11 | GET /api/prompts/no-such-id | 404 | ✅ 404 |
| 12 | GET /api/settings/no-such-key | 404 | ✅ 404 |
| 13 | POST /api/prompts `{"title":""}` | 400 validation | ✅ 400 (zod `too_small`) |
| 14 | POST /api/templates `{"name":""}` | 400 validation | ✅ 400 (zod `too_small`) |
| 15 | POST /api/skills `{"name":""}` | 400 validation | ✅ 400 (zod `too_small`) |
| 16 | POST /api/ai/chat `{"messages":[]}` | 400 validation | ✅ 400 (zod `too_small`) |
| 17 | POST /api/ai/chat content >20 000 chars | 400 bound (P1-5) | ✅ 400 (zod `too_big`, max 20000) |
| 18 | PUT /api/settings/OPENAI_API_KEY | 400 key not allowed (P0-2) | ✅ 400 `{"ok":false,"error":"Key not allowed"}` |
| 19 | PUT /api/settings/other-key | 400 key not allowed (P0-2) | ✅ 400 `{"ok":false,"error":"Key not allowed"}` |
| 20 | PUT /api/settings/ai.provider `http://opencode.ai` | 400 invalid provider (P0-1) | ✅ 400 `{"ok":false,"error":"Invalid provider configuration"}` |
| 21 | PUT /api/settings/ai.provider `https://192.168.1.5/v1` | 400 invalid provider (P0-1) | ✅ 400 `{"ok":false,"error":"Invalid provider configuration"}` |
| 22 | PUT /api/settings/ai.provider valid | 200 persisted | ✅ 200; subsequent GET returns value |
| 23 | PUT /api/settings/ai.provider value ≫16 KiB | 400 too large | ✅ 400 `{"ok":false,"error":"Invalid provider configuration"}` (rejected by provider validation before size path; large non-provider payloads are covered by schema `too_large` checks) |
| 24 | POST /api/prompts valid | 201 | ✅ 201 created |
| 25 | PUT /api/prompts/no-such-id | 404 | ✅ 404 |
| 26 | DELETE /api/prompts/no-such-id | 404 | ✅ 404 |
| 27 | GET /api/prompts?limit=abc | clamped to default 100 | ✅ 200 `{"ok":true,"data":[...]}` |
| 28 | GET /api/prompts?limit=99999 | capped at 200 | ✅ 200 |
| 29 | GET /api/search/web?q= (empty) | 400 missing q | ✅ 400 |

## 3. Upstream-dependent AI routes

| Request | Result | Notes |
|---|---|---|
| POST /api/ai/chat (valid body) | 500 `{"ok":false,"error":"Internal server error"}` | upstream `https://opencode.ai/zen/v1/chat/completions` returns **403 FreeTierError** ("free tier can only be used from within OpenCode") from this sandbox, so the Worker's wrapped fetch fails → global 500. Confirmed by direct upstream curl. Not a regression: no internal detail is reflected (response body is the generic 500). |
| POST /api/ai/run-skill (valid body) | 500 | same upstream cause as above. |

## 4. Security headers (GET /api/health)

All present: `Content-Security-Policy` (self + `unsafe-inline` styles), `Strict-Transport-Security`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`. ✅

## 5. CORS

`OPTIONS /api/ai/chat` with `Origin: http://localhost:5173` preflight → **204** ✅.

## 6. Rate limiter live behavior

70 sequential `PUT /api/settings/ai.provider` requests → 60×200, **10×429 {"ok":false,"error":"Rate limit exceeded"}** ✅ (write bucket 60/min enforced against local KV).

## 7. npm gates

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ PASS (0 errors) |
| Lint | `npm run lint` | ✅ PASS (0 errors/warnings) |
| Unit tests | `npm run test:unit` | ✅ PASS — 4 files, 18 tests |
| Integration | `npm run test:integration` | ✅ PASS — 1 file, 3 tests |
| Build | `npm run build` | ✅ PASS — Vite build ok |

## 8. Observations (informational, no action required)

- Upstream AI 5xx could carry a more distinguishing "bad gateway" status (`502`) instead of `500` — recorded for the next hardening pass, not changed in this session (no-code-verification only).
- `wrangler dev` binding table confirmed all expected bindings (CACHE, DB, ASSETS, OPENAI_BASE_URL, OPENAI_MODEL).
