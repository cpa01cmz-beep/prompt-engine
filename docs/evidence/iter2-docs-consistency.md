# Iteration 2 — Docs consistency pass (post-remediation)

**Date**: 2026-10-20
**Repo state**: `d5c4610` (docs pass on top of `338f22d`; remediation commit under review: `1435e2a`)
**Scope**: documentation only — `docs/api.md`, `docs/architecture.md`, `docs/setup.md`, `docs/user-flows.md`, plus `.env.example` (configuration documentation). No changes to `src/`, `tests/`, `package.json`, or build config.
**Inputs**: `docs/evidence/iter2-remediation.md`, `docs/evidence/iter2-gates-4-final-report.md`, and direct inspection of the source at HEAD.

---

## 1. Quality gates

| Command | Exit | Result | Log |
| --- | --- | --- | --- |
| `npm run lint` | **0** | 0 errors, 3 warnings — all pre-existing `Unused eslint-disable directive` warnings in `coverage/*.js` (build artefacts, not source) | `docs/evidence/iter2-docs-lint.log` |
| `npm run typecheck` | **0** | `tsc -b`, no diagnostics | `docs/evidence/iter2-docs-typecheck.log` |

Both are unaffected by this pass because no TypeScript or test file was touched (`git status` at time of writing: `.env.example`, `docs/api.md`, `docs/architecture.md`, `docs/setup.md`, `docs/user-flows.md`).

---

## 2. Doc sections changed

### `docs/api.md`

| Section | Change |
| --- | --- |
| `POST /api/ai/generate-prompt` → **Field and aggregate bounds** (line 32) | New table: per-field caps (`goal` 1–20,000; `role`/`constraints`/`examples` ≤ 20,000; `variables` ≤ 50 items, each ≤ 20,000 — `src/worker/schemas.ts:5,119-123`) **plus** the aggregate cap: `goal` + `role` + `constraints` + `examples` + `variables` joined with `", "` ≤ **64,000 chars** (`src/worker/schemas.ts:12,30-45,125-134`). Documents the `400` envelope and the `Total context is <n> characters; the limit is 64000` message. |
| `POST /api/ai/generate-prompt` → **Errors** table, `400` row (line 49) | Cause now names "total context over the 64,000-char cap" in addition to per-field violations. |
| Other AI endpoints table — `/api/ai/models` (line 79), `/api/ai/test` (line 80) | Added the new `baseUrl` validation results: `400 { ok:false, error: "baseUrl must be a public https URL" }` and `403 { ok:false, error: "baseUrl origin is not allowed" }`. |
| New **`baseUrl` trust boundary** subsection (line 82) | Shape check (`isPublicHttpsUrl`), origin-trust check (`OPENAI_BASE_URL` / `AI_PROVIDER_ALLOWLIST`), check ordering (auth → required fields → `resolveBaseUrl` → fetch), and the credential rule (`callerKey || env.OPENAI_API_KEY`), including the evidence that loopback/metadata probes never reach the network. |

### `docs/architecture.md`

| Section | Change |
| --- | --- |
| Worker request flow → step 3 **Validate** (line 96) | Added the aggregate-context bound (`composedContextChars` + `.superRefine`, `MAX_CONTEXT_CHARS` 64,000) and why per-field caps alone are insufficient (~1 MB legal input). |
| Mermaid **System diagram** (line 20) | Added three `%%` comment lines recording the `baseUrl` trust boundary, so the diagram does not imply that caller-supplied origins are fetched unchecked. Node/edge labels are unchanged and still match the code. |
| New **`baseUrl` trust boundary** section (line 106) | Four ordered steps: validate shape → check origin trust → resolve credentials (env key only on trusted origins) → fetch. |
| AI provider integration pattern (line 166) | New bullet: `/api/ai/models` and `/api/ai/test` validate the caller `baseUrl` before any fetch; the env provider key is never sent to a caller-chosen host. |
| Security posture (line 173) | New sentence: composed AI context capped at `MAX_CONTEXT_CHARS` 64,000 so per-field caps cannot be summed into a ~1 MB prompt. |

### `docs/setup.md`

| Section | Change |
| --- | --- |
| Configure environment → `.env.example` excerpt (line 39) | `OPENAI_MODEL=deepseek-v4.1-flash-free` (was `deepseek-v4-flash-free`). |
| Configure environment → discrepancy note (line 43) | Replaced the "Discrepancy (verified)" warning with an "updated" note: `.env.example` now matches `wrangler.toml` and the code default, and records that the old id was wrong. |

### `docs/user-flows.md`

| Section | Change |
| --- | --- |
| Flow A → new bullet (line 13) | One line: composed context capped at 64,000 chars server-side, and validation/generation failures (`{ ok:false, error }`) surface as an `Alert` via `ErrorText`. |

### `.env.example`

| Change |
| --- |
| `OPENAI_MODEL=deepseek-v4-flash-free` → `OPENAI_MODEL=deepseek-v4.1-flash-free` (line 2). This was the only remaining drift: `wrangler.toml:12` and `src/worker/services/ai.ts:8` both use `deepseek-v4.1-flash-free`, and `tests/unit/ai.test.ts:10` asserts that default. No other tracked file referenced the stale id. |

---

## 3. Verified code claims (file:line at HEAD `d5c4610`)

Line numbers were verified by matching the live source, not from the prior evidence documents (a few of those were written against `338f22d` and have drifted).

| Claim | Location | Verification |
| --- | --- | --- |
| `MAX_TEXT = 20_000` (per-field cap) | `src/worker/schemas.ts:5` | `const MAX_TEXT = 20_000;` |
| `MAX_CONTEXT_CHARS = 64_000` | `src/worker/schemas.ts:12` | `export const MAX_CONTEXT_CHARS = 64_000;` |
| Context sum = goal + role + constraints + examples + `variables.join(", ")` | `src/worker/schemas.ts:30-45` | function body read at HEAD |
| `goal` / `role` / `variables` / `constraints` / `examples` field shapes (incl. `variables` ≤ 50) | `src/worker/schemas.ts:119-123` | object literal inside `GeneratePromptSchema` |
| Aggregate `.superRefine` + exact message `"Total context is " + total + " characters; the limit is " + MAX_CONTEXT_CHARS` | `src/worker/schemas.ts:125-134` (message at `:130`) | read at HEAD |
| Zod failure → `400 { ok:false, error: parsed.error.message }` on `/generate-prompt` | `src/worker/routes/ai.ts:78` | route body |
| `resolveBaseUrl` (trim → `isPublicHttpsUrl` → trust → key) | `src/worker/routes/ai.ts:314-325` | function read at HEAD |
| `400 { ok:false, status:400, error:"baseUrl must be a public https URL" }` | `src/worker/routes/ai.ts:316-317` | literal string |
| Trust test = `isTrustedAiOrigin(...)` OR `trustedProviderOrigins(env).has(origin)` | `src/worker/routes/ai.ts:319-320` | read at HEAD |
| `403 { ok:false, status:403, error:"baseUrl origin is not allowed" }` | `src/worker/routes/ai.ts:321-323` | literal string |
| Resolved key = `callerKey \|\| env.OPENAI_API_KEY \|\| ""` | `src/worker/routes/ai.ts:324` | read at HEAD |
| `POST /api/ai/models` handler, `baseUrl is required` → 400, envelope, fetch | `src/worker/routes/ai.ts:334`, `:342`, `:343-344`, `:349`, `:351` | read at HEAD |
| `POST /api/ai/test` handler, `baseUrl`/`model` required → 400, envelope, fetch | `src/worker/routes/ai.ts:377`, `:393-394`, `:396-397`, `:409`, `:422` | read at HEAD |
| Bearer auth 401 at both routes | `src/worker/routes/ai.ts:337,339` and `:380,382` | `if (!token) … 401`, `if (!user) … 401` |
| `/api/ai` mount point | `src/worker/index.ts:37` | `app.route("/api/ai", ai);` |
| `isPublicHttpsUrl`: https only, no credentials, ≤2048 chars, no localhost, no private/reserved IP | `src/worker/lib/url.ts:1,38-55` | function read at HEAD |
| `MAX_URL_LENGTH = 2048` | `src/worker/lib/url.ts:1` | constant |
| `trustedProviderOrigins` (env origin + `AI_PROVIDER_ALLOWLIST`) | `src/worker/services/aiProvider.ts:15-24,27-38` | read at HEAD |
| `DEFAULT_MODEL = "deepseek-v4.1-flash-free"` | `src/worker/services/ai.ts:8` | constant |
| `OPENAI_MODEL = "deepseek-v4.1-flash-free"` | `wrangler.toml:12` | `[vars]` block |
| `ErrorText` renders `<Alert tone="error" title="Error">` | `src/client/components/ui.tsx:164-166` | read at HEAD |
| `Alert` default `role` is `"status"` (`aria-live` = `"polite"`) | `src/client/components/ui.tsx:128-137` | `role = "status"` default + `aria-live` ternary |
| PromptCreator renders `<ErrorText message={error} />` under the Generate row | `src/client/modules/PromptCreator.tsx:161` | read at HEAD; `setError` in `generate` at `:55` |

---

## 4. Claims that needed correction, and what could not be verified

1. **"Generation errors surface as an `Alert`" — verified, with one nuance.** `PromptCreator.tsx:161` renders `<ErrorText message={error} />`, and `ErrorText` (`ui.tsx:164-166`) *is* `<Alert tone="error">`. However, `Alert`'s default `role` is `"status"` and its `aria-live` is `"polite"` (`ui.tsx:128-137`), so the error is announced politely, not assertively — this is residual finding **R-6** in `docs/evidence/iter2-gates-4-final-report.md`, still open. The docs say "surfaces as an `Alert`" and do not claim `role="alert"`.
2. **Shape of the aggregate-cap response body.** The route returns `parsed.error.message`, which is the JSON-serialized zod issue array (residual **R-8**), not a plain string. `docs/api.md` therefore documents the envelope as `400 { ok:false, error: <zod message> }` and states that the message *contains* `Total context is <n> characters; the limit is 64000`, matching probe Q1 in `docs/evidence/iter2-gate4-final-m1-probe.log:22`.
3. **`.env.example` drift — resolved.** The correct id is `deepseek-v4.1-flash-free` (verified in `wrangler.toml:12`, `src/worker/services/ai.ts:8`, `tests/unit/ai.test.ts:10`); `.env.example` was the only stale artefact and is now aligned. `docs/setup.md` records the change instead of the previous "discrepancy" warning.
4. **Not re-probed in this pass.** The 400/403 behaviour and the `localServerHits=0` / `outboundFetchCalls=0` results are quoted from the independent probes in `docs/evidence/iter2-gates-4-final-report.md` and its `ai-baseurl-guard` tests (17/17 at HEAD); no new live probes were run, because this pass is docs-only and the suite that covers it (75/75 unit, 34/34 targeted) is unchanged since that run.
5. **`/api/ai/test` upstream-failure shape is unchanged and still asymmetric.** It returns HTTP 200 with `{ ok:false, error: "HTTP <status>: <text>" }` (`src/worker/routes/ai.ts:422`) and `500 { ok:false, error: String(err) }` (`:427`), whereas `/api/ai/models` returns `502` (`:351`). `docs/api.md` documents both as-is; this is residual **R-4**, out of scope for a docs pass.

---

## 5. Commands run

```bash
npm run lint      # exit 0
npm run typecheck # exit 0
git status --porcelain -uall
#  M .env.example
#  M docs/api.md
#  M docs/architecture.md
#  M docs/setup.md
#  M docs/user-flows.md
```
