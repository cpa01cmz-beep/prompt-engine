# Iteration 2 — Gate 4 Remediation

**Date:** 2026-10-20
**Scope:** H-1 (High, blocking), M-1 (Medium), L-1 (Low) only. No other findings touched.
**Status:** fixes implemented, uncommitted in the working tree (per instruction).

---

## 1. Findings addressed

| ID | Finding | Disposition |
| --- | --- | --- |
| **H-1** | `POST /api/ai/models` and `POST /api/ai/test` accepted a caller-supplied `baseUrl` and attached `env.OPENAI_API_KEY`, enabling authenticated SSRF + key exfiltration. | **FIXED** — every caller-supplied base URL is now validated before any outbound fetch; the env key is only attached to an operator-trusted origin. |
| **M-1** | Context was bounded per field but not in aggregate (60 × 20k ⇒ 1,080,216-char body accepted). | **FIXED** — `GeneratePromptSchema` now enforces a 64 000-char composed-context cap. |
| **L-1** | Stale "Saved to library." banner survived Evaluate/Optimize. | **FIXED** — `setSuccess(null)` at the start of both handlers. |

Out of scope (unchanged, still open from the Gate 4 report): L-2 (`role="alert"`), L-3 (auth on generation routes), upstream-text reflection on `/test` and `/models`.

---

## 2. Changes (file:line, final state)

### H-1 — `src/worker/routes/ai.ts`

- `:15` `isTrustedAiOrigin` added to the existing `../services/ai` import.
- `:17` `import { trustedProviderOrigins } from "../services/aiProvider";`
- `:18` `import { isPublicHttpsUrl } from "../lib/url";`
- `:308-329` new `resolveBaseUrl(raw, env, callerKey): BaseUrlResolution`:
  - `:316` `!isPublicHttpsUrl(baseUrl)` ⇒ `{ ok: false, status: 400, error: "baseUrl must be a public https URL" }`
    (rejects non-https, `localhost`, loopback/private/link-local/CGNAT IP literals, embedded credentials).
  - `:319-321` `trusted = isTrustedAiOrigin(baseUrl, env) || trustedProviderOrigins(env).has(new URL(baseUrl).origin)`
    (trusted = `OPENAI_BASE_URL` / `AI_PROVIDER_ALLOWLIST`, plus the `api.openai.com` default that `isTrustedAiOrigin` already honours).
  - `:322-324` untrusted origin **and** no caller key ⇒ `{ ok: false, status: 403, error: "baseUrl origin is not allowed" }`.
  - `:326` otherwise `{ ok: true, baseUrl, apiKey: callerKey || env.OPENAI_API_KEY || "" }` — the env key is reachable only on the trusted path.
- `:343-346` `/models`: `resolveBaseUrl` runs immediately after the `baseUrl is required` check and **before** the URL is built and `fetch` is called; failures return the existing `{ ok: false, error }` envelope with 400/403.
- `:391-398` `/test`: same gate after the `baseUrl`/`model` presence checks and before `fetch`; `rawBaseUrl` is renamed so the destructured, validated `baseUrl` cannot be shadowed by unvalidated input.

Behavioural contract preserved: the configured origin (`OPENAI_BASE_URL`, the default `https://api.openai.com/v1`, or anything in `AI_PROVIDER_ALLOWLIST`) keeps working exactly as before and still receives the env key. A public, non-allowlisted origin is still usable, but only with the caller's **own** key — the operator key is never sent there.

### M-1 — `src/worker/schemas.ts`

- `:12` `export const MAX_CONTEXT_CHARS = 64_000;`
- `:30-42` `composedContextChars(value)` = `goal.length + role + constraints + examples + variables.join(", ").length`.
- `:117-133` `GeneratePromptSchema` keeps every per-field cap (`BoundedText` = 20 000, ≤ 50 variables) and adds `.superRefine` that emits a `ZodIssue` with `message: "Total context is <n> characters; the limit is 64000"` when the composed total exceeds `MAX_CONTEXT_CHARS`.

Per-field caps are untouched, so the 20 001-char field rejection and the 51-variable rejection still fire first; the aggregate bound only catches combinations that are individually legal.

### L-1 — `src/client/modules/PromptCreator.tsx`

- `:86` `evaluate`: `setSuccess(null)` after `setError(null)`.
- `:100` `optimize`: `setSuccess(null)` after `setError(null)`.
  (`generate` `:49` and `save` `:64` already did this.)

---

## 3. Tests added

### `tests/unit/ai-baseurl-guard.test.ts` (new, 17 tests)

Route-level tests using the project's existing style (`app.request(path, init, env)` as in `tests/integration/smoke.test.ts`) against the real Hono app from `src/worker/routes/ai.ts`, with `auth.getSessionUser` mocked to a valid session and `fetch` stubbed globally.

- `/models` and `/test`: `http://169.254.169.254/...`, `https://169.254.169.254/...`, `http://localhost:...`, `https://localhost/...`, `https://127.0.0.1/...` ⇒ **400** `baseUrl must be a public https URL`, `fetch` never called.
- `/models` and `/test`: `https://evil.example/v1` with no caller key ⇒ **403** `baseUrl origin is not allowed`, `fetch` never called.
- `/models` and `/test`: configured origin `https://opencode.ai/zen/v1` ⇒ **200**, exactly one `fetch`, correct path (`/models`, `/chat/completions`) and `Authorization: Bearer env-secret`.
- `/models`: `AI_PROVIDER_ALLOWLIST=api.example.com` ⇒ allowlisted origin accepted and receives the env key.
- `/models`: `https://public.example/v1` + caller key ⇒ accepted, `Authorization: Bearer caller-key` (**not** the env secret).
- `/test`: missing model still ⇒ 400 `model is required` before any fetch.

### `tests/unit/schemas.test.ts` (+6 tests)

- 1,080,216-char context (50 × 20k variables + four 20k fields) ⇒ rejected with an issue message containing `64000`.
- exactly 64 000 chars (20k + 20k + 20k + 4k) ⇒ accepted.
- 64 001 chars ⇒ rejected.
- separator accounting: `variables: ["a","b"]` contributes `"a, b"` (4 chars), so 63 999 + 4 ⇒ rejected.
- per-field caps still apply: `goal` 20 001, `role` 20 001, 51 variables ⇒ rejected.
- goal-only context still accepted.

---

## 4. Verification commands

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | **0** | `tsc -b`, no errors |
| `npm run lint` | **0** | 0 errors, 3 warnings (pre-existing `coverage/*.js` unused-disable warnings) |
| `npm run test:unit` | **0** | **9 files / 75 tests passed** (was 9 / 52 before this change; +23) |
| `npm run test:integration` | **0** | **1 file / 3 tests passed** |
| `npm run test:e2e` | see §5 | |

ESLint/TS ran over the new test file as part of `eslint .`; `tsc -b` covers `src/**` (test files are outside `tsconfig.worker.json`'s `include`, as before).

## 5. E2E

`npx playwright test --reporter=line` (all 3 browsers, 108 tests) was started but **did not complete**: the run was killed by a 420 s `timeout`, exit **124**, after reaching `[91/108]` (last line `[91/108] [webkit] … Library renders content`). No failure line was emitted before the kill, and 91/108 including the Chromium `flows.spec.ts` / `iter2-console.spec.ts` journeys had progressed — but this is **not** a pass. Per the instruction ("only if quick"), E2E is reported as **not run to completion**; QA must re-run it in the next gate on a machine with a longer budget.

---

## 6. Residual risk / follow-ups

1. **Upstream text reflection (still open, from H-1 write-up):** `/models` returns `Upstream error <status>` and `/test` returns `HTTP <status>: <upstream text, 300 chars>`. Both are now reachable only via an allowlisted origin or with the caller's own key, so the reflected text is the caller's own upstream, but replacing these with `mapOutboundError` would make the error surface uniform. Not done here (out of the instructed scope).
2. **Auth on generation routes (L-3):** unchanged, pre-existing.
3. **Non-allowlisted public origins with a caller key remain allowed** — deliberate, to keep custom-provider users working; the operator key is never attached in that case.
4. **`/test` `String(err)` in the 500 branch** still reflects internal error text; out of scope (L-1..L-3 list), unchanged.
5. Client-side limiter: the aggregate cap is server-side; the client does not pre-check total context length, so a >64k submission now surfaces the zod message ("Total context is N characters; the limit is 64000") as a generic error banner.
