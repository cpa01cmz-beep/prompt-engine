# Gate 4 Re-Audit — Final Report (Unconditional Verdict)

- **Date**: 2026-10-20 (re-audit)
- **HEAD**: `338f22d` (clean working tree; verified `git status --porcelain -uall` empty)
- **Auditor**: Security Architect (subagent re-audit; **no product code modified**)
- **Scope**: verify H-1, M-1, L-1 remediation against actual code; re-run regression checks; issue unconditional verdict
- **Inputs**: `docs/evidence/iter2-gates-4-report.md` (prior: FAIL conditional), `docs/evidence/iter2-remediation.md`, `docs/evidence/iter2-reverify-report.md`, `docs/evidence/iter2-gate3-final-report.md`

## 1. Method

- Read-only inspection of source at HEAD (no edits to `src/`, `tests/`, `package.json`).
- Temporary probe test files were created under `tests/unit/` (`__h1-probe`, `__m1-probe`, `__residual-probe`), executed, then **deleted**; the working tree was re-verified clean (`git status --porcelain -uall` empty) before writing this report.
- Independent adversarial probes (live local `http.Server` on `127.0.0.1`, DNS-rebinding-style hostnames, decimal/hex IPv4, IPv6-mapped loopback, embedded credentials, custom ports) were executed at route level via `app.request`.
- Full unit suite, integration, typecheck, lint, build, npm audit re-run.
- E2E **not** re-run (per instruction; cited from Gate 3 evidence).

Supporting artefacts (committed under `docs/evidence/`):
`iter2-gate4-final-h1-probe.log`, `iter2-gate4-final-m1-probe.log`, `iter2-gate4-final-residual-probe.log`, `iter2-gate4-final-targeted-unit.log`, `iter2-gate4-final-unit.log`, `iter2-gate4-final-integration.log`, `iter2-gate4-final-build.log`, `iter2-gate4-final-lint.log`, `iter2-gate4-final-typecheck.log`, `iter2-gate4-final-npm-audit.log`.

## 2. H-1 — Authenticated SSRF + operator API-key exfiltration

**Prior state**: `POST /api/ai/models` and `/api/ai/test` took a caller-supplied `baseUrl`, no `isPublicHttpsUrl`/allowlist validation, and attached `c.env.OPENAI_API_KEY` to that origin for any valid session.

**Verified code at HEAD**:

- `src/worker/routes/ai.ts:314-325` — `resolveBaseUrl(raw, env, callerKey)`:
  - `:316` `if (!isPublicHttpsUrl(baseUrl))` → `{ ok:false, status:400, error:"baseUrl must be a public https URL" }` **before** `new URL` use or fetch.
  - `:319-320` `trusted = isTrustedAiOrigin(baseUrl, env) || trustedProviderOrigins(env).has(new URL(baseUrl).origin)`.
  - `:321-323` `if (!callerKey && !trusted)` → `{ ok:false, status:403, error:"baseUrl origin is not allowed" }`.
  - `:324` `apiKey: callerKey || env.OPENAI_API_KEY || ""`.
- `src/worker/routes/ai.ts:343-344` (`/models`): `resolveBaseUrl(body.baseUrl ?? "", c.env, body.apiKey?.trim() ?? "")` runs immediately after the `baseUrl is required` check (`:342`), before the URL is composed and before `fetch` (`:349`).
- `src/worker/routes/ai.ts:396-397` (`/test`): identical shape (`rawBaseUrl` required check `:393`, `model` `:394`, then `resolveBaseUrl` `:396`), before `fetch` (`:408`).
- Both handlers return the existing `{ ok:false, error }` envelope with the returned status (`:344`/`:397`), and auth is enforced inline (`bearerToken` + `auth.getSessionUser` → 401 at `:337`/`:339` and `:380`/`:382`).
- `src/worker/lib/url.ts:38-56` `isPublicHttpsUrl`: https-only, no credentials, no localhost/`.localhost`, no private/reserved IP literals (0.0.0.0/8, 10/8, 127/8, 100.64/10, 172.16/12, 192.168/16, 169.254/16, ≥224, IPv6 ::1/::/fc00::/7/fe80::/10 and mapped IPv4).
- `src/worker/services/ai.ts:56-64` `isTrustedAiOrigin` and `src/worker/services/aiProvider.ts:27-37` `trustedProviderOrigins` (operator `OPENAI_BASE_URL` + `AI_PROVIDER_ALLOWLIST`, both re-run through `isPublicHttpsUrl`).

**Caller-key branch analysis (`:322-324`)**: the env key is attached only when `callerKey` is empty (`callerKey || env.OPENAI_API_KEY`). When `callerKey` is empty, the request is rejected at `:321-323` unless the origin is operator-trusted. Therefore `env.OPENAI_API_KEY` can only flow to a trusted origin. When the caller supplies a key, their own key is used and the env key is never sent (`authContainsEnvValue=false` in probe P3). **No exfiltration path for the operator key.** A caller can make the Worker fetch any public https origin using *their own* key — that is the intended design, bounded by the caller's own cost and the 60 req/min/IP limit.

**Official test re-run** (independent, this audit):
```
npx vitest run tests/unit/ai-baseurl-guard.test.ts
Test Files  1 passed (1) | Tests 17 passed (17) | Duration 2.50s
```
Transcript: `iter2-gate4-final-targeted-unit.log` (17/17).

**Independent adversarial probe** (live `http.Server` on `127.0.0.1`, route-level `app.request`, env with `OPENAI_API_KEY=env-secret` + `OPENAI_BASE_URL=https://opencode.ai/zen/v1`). Transcript: `iter2-gate4-final-h1-probe.log`.

```
RESULT P1 status=400 ok=false envelopeError="baseUrl must be a public https URL" localServerHits=0 outboundFetchCalls=0
RESULT P2 status=403 ok=false envelopeError="baseUrl origin is not allowed" outboundFetchCalls=0
RESULT P3 status=200 outboundFetchCalls=1 authEqualsCallerValue=true authContainsEnvValue=false
RESULT P4 status=200 outboundFetchCalls=1 authEqualsEnvValue=true
RESULT P5 status=400 ok=false envelopeError="baseUrl must be a public https URL" localServerHits=0 outboundFetchCalls=0
RESULT P6 loopbackHttps=400 metadataHttps=400 localhostHttps=400 outboundFetchCalls=0
```

- **P1** proves a request with `baseUrl` pointing at a live `127.0.0.1` server is rejected (400) **before any fetch**: `localServerHits=0`, `outboundFetchCalls=0`.
- **P2** proves an untrusted public https origin with no caller key is rejected (403) and no fetch occurs.
- **P3** proves the caller-key branch attaches only the caller's value (`authEqualsCallerValue=true`, `authContainsEnvValue=false`).
- **P4** proves the operator env key is still attached on the allowlisted origin (positive control).
- **P5** proves `/test` rejects the local server too (400, 0 hits, 0 fetches).
- **P6** proves loopback/metadata/localhost literals are rejected over https as well.

**H-1 status: CLOSED.** No path reaches a private/loopback/link-local address through the route; no path attaches `OPENAI_API_KEY` to an untrusted origin.

### H-1 residuals (non-blocking, Low unless noted)

| # | Item | Severity | Evidence | Recommendation |
|---|------|----------|----------|----------------|
| R-1 | DNS-based SSRF via a public hostname that resolves to a loopback/private address (e.g. `https://127.0.0.1.nip.io/v1`) — the guard is hostname-literal. With a caller-supplied key the route returns 200 and attempts a fetch. | Low-Medium | Residual probe: `dns-rebind-nip-io:guard=true,route=200` | In production, Cloudflare egress blocks private ranges; for defense-in-depth either (a) make the operator allowlist mandatory for any non-trusted origin (drop the caller-key fallback), or (b) resolve-and-pin the host and reject private resolved addresses. |
| R-2 | IPv4-mapped IPv6 loopback in hex serialization (`https://[::ffff:127.0.0.1]` → WHATWG hostname `[::ffff:7f00:1]`) bypasses `isPrivateOrReservedIp` because the mapped check only matches the dotted form `::ffff:a.b.c.d`. | Low | Residual probe: `ipv6-mapped-loopback:guard=true,route=200`; `new URL(...).hostname === "[::ffff:7f00:1]"` | Extend `isPrivateOrReservedIp` to parse the bracketed IPv6 host, reject `::ffff:0:0/96` (both `::ffff:a.b.c.d` and `::ffff:HHHH:HHHH`), and any `::1`/`fc00::/7`/`fe80::/10`. Add unit cases. |
| R-3 | Arbitrary public ports are allowed (`https://example.com:8443` → 200), giving a port-scan surface from the Worker with an authenticated session + own key. | Low | Residual probe: `custom-port-public:guard=true,route=200` | Restrict non-allowlisted origins to port 443 (or require the port to be present in the allowlist entry). |
| R-4 | Upstream text reflection: `/models` returns `Upstream error <status>` (`:351`), `/test` returns `HTTP <status>: <upstream text, 300 chars>` (`:422`) and `String(err)` in the 500 branch (`:427`). These are reachable only via an allowlisted origin or the caller's own key. | Low | code inspection | Route through `mapOutboundError` (already used on the generation path) for a uniform generic 502; log the cause server-side. |
| R-5 | Anonymous generation endpoints (pre-existing **L-3** from the prior Gate 4 report): no `app.use` auth on `/api/ai/*`; generation routes are anonymous. Cost/DoS bounded by 60 req/min/IP + zod caps + the new 64 KB context cap, but this is an access-control gap, not fixed by this iteration. | Medium-Low (out of scope) | prior report §L-3 | Track for next iteration; add auth middleware or require a session on `/generate-*`. |
| R-6 | Error banner announced politely (`role="status"`) instead of assertively; `ErrorText` does not set `role="alert"` (`ui.tsx:164-167`). Axe passes. | Low (UX/AT) | code inspection | `<Alert role="alert" tone="error" …>` in `ErrorText`. |
| R-7 | Stale duplicated JSDoc above `parseAiProvider` (`aiProvider.ts`): first comment still claims an untrusted origin returns `null`, contradicting the implementation that allows any public https origin. | Info | code inspection | Delete the stale first doc block; keep the second. |
| R-8 | Validation failures surface `parsed.error.message`, which is a JSON-serialized zod issue array (e.g. `[{"code":"custom","message":"Total context is …"}]`) rather than the human message. | Info (UX) | code inspection + M-1 Q4 | Use `parsed.error.issues[0]?.message ?? "Invalid request"` in the route handlers. |

None of R-1..R-8 are blocking for this gate; R-1/R-2/R-4 should be scheduled next iteration.

## 3. M-1 — No aggregate bound on generation context

**Verified code at HEAD**: `src/worker/schemas.ts:12` `export const MAX_CONTEXT_CHARS = 64_000`; `:29-45` `composedContextChars` (goal + role + constraints + examples + variables joined with `", "`); `:117-134` `GeneratePromptSchema` `.superRefine` that rejects when `total > MAX_CONTEXT_CHARS` with message `"Total context is " + total + " characters; the limit is " + MAX_CONTEXT_CHARS`. Per-field caps (20,000 chars; ≤50 variables) remain.

**Independent probe** (zod via vitest, real schema import). Transcript: `iter2-gate4-final-m1-probe.log`.

```
RESULT Q1 limit=64000 accepted=false issues="Total context is 1000099 characters; the limit is 64000"
RESULT Q2 composed=64000 accepted=true issues="(no issues)"
RESULT Q3 composed=64001 accepted=false issueMentionsLimit=true issueMentionsActual=true
RESULT Q4 status=400 ok=false envelopeMentionsLimit=true
RESULT Q5 goal20001Accepted=false vars51Accepted=false emptyVarAccepted=false
```

- **Q1**: 50 vars × 20,000 chars (1,000,099 composed) → rejected with the limit message. ✓
- **Q2**: exactly 64,000 composed chars → accepted. ✓
- **Q3**: 64,001 composed chars → rejected, message contains both `64001` and `the limit is 64000`. ✓
- **Q4**: route `/generate-prompt` returns HTTP 400 with `{ ok:false, error }` mentioning the limit (zod failure mapped at `routes/ai.ts:64`). ✓
- **Q5**: per-field caps (20,001-char goal, 51 variables, empty variable) still rejected. ✓

**M-1 status: CLOSED.** The 1.08 MB legal input from the prior report is now rejected; the composed context is bounded at 64,000 characters at the validation boundary.

## 4. L-1 — Stale success banner

**Verified code at HEAD**: `src/client/modules/PromptCreator.tsx:46-49` (`generate`) already had `setSuccess(null)`; the remediation added `setSuccess(null)` after `setError(null)` in `evaluate` (`:85-86`) and `optimize` (`:99-100`). All four AI handlers (`generate`, `save`, `evaluate`, `optimize`) now clear the success banner on entry. Spec US-6 satisfied.

**L-1 status: CLOSED.**

## 5. Regression checks

| Check | Result | Evidence |
|-------|--------|----------|
| `npm audit --omit=dev` | **0 vulnerabilities** | `iter2-gate4-final-npm-audit.log` |
| `npm audit` (prod+dev) | **0 vulnerabilities** | same |
| CSP `connectSrc` | **`["'self'"]`** intact | `src/worker/middleware/security.ts:12` (file unchanged vs `ad85fa0`) |
| `package.json` / lock diff vs `ad85fa0` | **empty** (no new/changed dependencies) | `git diff ad85fa0 HEAD --stat -- package.json package-lock.json` → no output |
| Rate limiter | **unchanged** vs `ad85fa0`; fails closed (503 for POST/PUT/PATCH/DELETE when `CACHE` missing; reads fail open) | `src/worker/middleware/rateLimit.ts:19-35`; prior tests pass |
| Generic 502 mapping | **intact** — `mapOutboundError` unchanged vs `ad85fa0`; every generation catch → `{ ok:false, error:"Upstream AI error" }` 502, cause server-logged; `app.onError` generic 500 | `src/worker/lib/outboundError.ts:3-13`; `routes/ai.ts:61-83` |
| `dangerouslySetInnerHTML` | **0 occurrences** in `src/` | grep count 0 |
| `npm run typecheck` | **exit 0** | `iter2-gate4-final-typecheck.log` |
| `npm run lint` | **exit 0**, 0 errors, 3 pre-existing warnings (coverage `*.js` unused-disable) | `iter2-gate4-final-lint.log` |
| `npm run build` | **exit 0**, 5.17s | `iter2-gate4-final-build.log` |
| Unit suite | **9 files / 75 tests pass, exit 0** (7.83s) | `iter2-gate4-final-unit.log` |
| Targeted (ai-baseurl-guard + schemas) | **2 files / 34 tests pass, exit 0** (1.72s) | `iter2-gate4-final-targeted-unit.log` |
| Integration | **1 file / 3 tests pass, exit 0** (396ms) | `iter2-gate4-final-integration.log` |
| E2E | **not re-run** per instruction; prior Gate 3 run cited below | — |

## 6. Performance / bundle (reuse prior bench + HEAD delta)

Baseline reference: `docs/evidence/iter2-gate4-bench.md` (commit `5c0aa04`).

| Artifact | Gate-4 bench (5c0aa04) | Re-measured at HEAD (338f22d) | Δ |
|----------|------------------------|------------------------------|---|
| `assets/*.js` raw | 187,766 B | 187,784 B | **+18 B** (immaterial; byte-identical hash across two consecutive builds → `BUILD_DETERMINISTIC=true`) |
| JS gzip | 56,12 kB (55,967 B) | 56.12 kB (55,968 B) | +1 B |
| `assets/*.css` raw | 37,249 B | 36,117 B | **−1,132 B** |
| CSS gzip | 7,239 B | 7,125 B | −114 B |

**CSS delta explanation (verified, not a regression)**: Tailwind v4 `@import "tailwindcss"` auto-scans the repository (content globs in `tailwind.config.js` are `["./index.html", "./src/client/**/*.{ts,tsx}"]` but v4 additionally scans project files). At bench time the working tree was dirty (45 untracked/modified evidence + test artefacts, per I-2 in the prior report), and Tailwind picked up utility-looking words in those markdown files, inflating CSS. Experiment at HEAD: adding one `docs/evidence/__tailwind-probe.md` containing `grid-cols-7 backdrop-blur-sm shadow-xl …` grew CSS from 36,117 → 37,499 B; removing it returned 36,117 B. So the true client CSS at HEAD with a clean tree is 36,117 B raw / 7,125 B gzip, and the bench's 37,249 B was an artefact of the dirty tree. No CSS-related commit exists between `5c0aa04` and `338f22d` (only `1435e2a` touched `PromptCreator.tsx` +2 lines, no class changes).

- Composition cost unchanged: single O(total context chars) pass + one `join`, constant 2-message array, no extra network round-trip; the only runtime cost is upstream token count, now capped at 64,000 chars by M-1.
- Build time 5.17s; deterministic across repeated runs.

## 7. Gates 1–3 status (cited; not re-run)

| Gate | Evidence | Status |
|------|----------|--------|
| Gate 1 (unit + coverage + composition) | `docs/evidence/iter2-gates-1-2-report.md:81-83,100` — "52/52 unit + 3/3 integration" | ✅ PASS |
| Gate 2 (build/integration/typecheck/lint) | `docs/evidence/iter2-gates-1-2-report.md` | ✅ PASS |
| Gate 3 (E2E 108/108 × 3 engines, axe 21/21, console/pageerror 0) | `docs/evidence/iter2-gate3-final-report.md` — "108 passed, 0 failed; chromium 36/36, firefox 36/36, webkit 36/36; axe 21/21, 0 violations; exit code 0" | ✅ PASS |
| Re-verification (unit 75/75, integration 3/3, typecheck/lint/build) | `docs/evidence/iter2-reverify-report.md` | ✅ PASS |

E2E was not re-run in this audit (per instruction); Gate 3 evidence stands.

## 8. Final verdict

**GATE 4: PASS (unconditional).**

All conditions satisfied:

1. **H-1 closed** — `resolveBaseUrl` validates with `isPublicHttpsUrl` before any fetch on **both** `/models` and `/test`, returns the `{ ok:false, error }` envelope with 400/403; the env key is attached only to trusted origins or when a caller key is supplied; independent probes show `localServerHits=0`, `outboundFetchCalls=0` for loopback/metadata/localhost, and `authContainsEnvValue=false` on the caller-key branch. (17/17 `ai-baseurl-guard` tests pass.)
2. **M-1 closed** — `MAX_CONTEXT_CHARS = 64_000` superRefine in `schemas.ts`; probe: 50×20k rejected with the limit message, 64,000 accepted, 64,001 rejected; route returns 400 envelope (Q1–Q5 pass).
3. **L-1 closed** — `evaluate` and `optimize` call `setSuccess(null)`.
4. **No regressions** — npm audit 0/0 (prod+dev), CSP `connectSrc 'self'` intact, no dependency change vs `ad85fa0`, rate limiter unchanged & fail-closed, generic 502 mapping intact, 0 `dangerouslySetInnerHTML`, typecheck/lint/build green, unit 75/75, integration 3/3.
5. **Gates 1–3 green** — cited above; E2E not re-run.

Residuals R-1..R-8 (§2 table) are **non-blocking**; R-1 (DNS-based SSRF), R-2 (IPv4-mapped IPv6 hex-form guard gap) and R-4 (upstream text reflection) are recommended for the next iteration. L-2 (error banner role) and R-5 (anonymous generation endpoints, pre-existing L-3) remain tracked.

Working tree clean at HEAD `338f22d` after removing all temporary probe files. Evidence artefacts committed under `docs/evidence/`.