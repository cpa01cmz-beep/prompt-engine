# Gates 4 (Security · Performance · Resilience) — Iteration 2 audit report

- **Auditor:** Application Security Engineer (subagent), Gate 4
- **Date:** 2026-10-20
- **HEAD audited:** `57b6ad8` — `feat(automation+ux): context-aware prompt generation; grouped navigation with primary journey CTA; single-flow PromptCreator; E2E request-body test` (parent `ad85fa0`)
- **Scope:** iteration diff only (`App.tsx`, `client/lib/api.ts`, `modules/PromptCreator.tsx`, `worker/schemas.ts`, `worker/routes/ai.ts`, `worker/services/ai.ts`, tests/docs), plus adjacent code paths those changes rely on (rate limiter, error mapping, CSP, provider config).
- **Product code modified by this audit:** **none** (evidence files only).
- **Working tree:** not fully clean at start — Gate 3 left `M docs/orchestration_progress.md`, `M tests/e2e/flows.spec.ts`, untracked `tests/e2e/iter2-console.spec.ts` and evidence artefacts. **No product source file is dirty**; `package.json`/lockfile unchanged.

## Evidence index

| Evidence | File |
|---|---|
| Dependency audit (prod + dev) | `docs/evidence/iter2-gate4-npm-audit.log` |
| Build (sizes, exit 0) | `docs/evidence/iter2-gate4-build.log` |
| Performance numbers + baseline delta | `docs/evidence/iter2-gate4-bench.md` |
| Targeted resilience unit run | `docs/evidence/iter2-gate4-targeted-unit.log` |
| Server-side schema bound probe (50×20k) | `docs/evidence/iter2-gate4-context-bounds.log` |
| Full unit / integration re-runs | 52/52 (8 files) exit 0 · 3/3 exit 0 |

> Note: `.gitignore` excludes `*.log`; the four `iter2-gate4-*.log` files above must be committed with `git add -f` (all other existing evidence logs were added the same way).

---

## 1. Risk table

Severity uses exploitability × business impact (not raw CVSS). “Iteration” = introduced by `57b6ad8`.

| ID | Severity | Finding | Evidence (file:line) | Iteration? | Remediation status |
|---|---|---|---|---|---|
| **H-1** | **High** | **Authenticated SSRF + operator API-key exfiltration.** `POST /api/ai/models` takes a caller-supplied `baseUrl`, and `/api/ai/test` does the same, with **no** `isPublicHttpsUrl()` / allowlist validation. Both fall back to `c.env.OPENAI_API_KEY` when the caller sends no key, and send it as `Authorization: Bearer …` to that arbitrary origin. Any valid session (non-admin included) can therefore (a) probe internal/HTTP endpoints from the Worker and (b) exfiltrate the deployment's env API key to an attacker host. Same vulnerability class as previously-fixed F1, which only covered the settings path. | `src/worker/routes/ai.ts:307-323` (auth 309-312, key 319, headers 321-322, fetch 323); `/test`: `routes/ai.ts:351-380` (key 367, fetch 380); correct pattern to copy: `src/worker/services/ai.ts:83-90` + `isTrustedAiOrigin` `services/ai.ts:56-64` | No (pre-existing, commits `f5514a0`/`c8968e6`) | **OPEN — blocks unconditional gate pass.** Fix: `if (!isPublicHttpsUrl(baseUrl)) return 400;` and only attach `c.env.OPENAI_API_KEY` when `trustedProviderOrigins(c.env).has(new URL(baseUrl).origin)` (or require caller-supplied key for non-allowlisted origins). Also replace upstream-text responses at `routes/ai.ts:325` and `:393/:398` with `mapOutboundError`/generic text. |
| **M-1** | **Medium** | **No aggregate bound on generation context.** Each field is capped (20k chars, ≤50 variables) but there is no total-size cap, so a legal body of 50×20k variables + 20k goal + 20k role + 20k constraints + 20k examples = **1,080,216 chars** is accepted and concatenated into one upstream prompt. That is ~54× the pre-change 20k maximum per request, billed as provider tokens, on a route that requires no session (`routes/ai.ts:70`), bounded only by 60 write req/min/IP (`rateLimit.ts:45`). No memory/CPU crash risk at 1 MB. | `src/worker/schemas.ts:92-98`; probe `docs/evidence/iter2-gate4-context-bounds.log` (`50x20k_context_accepted= true`, `serialized_payload_chars= 1080216`; `51_vars_accepted= false`, `20001_char_role_accepted= false`) | **Yes** | **OPEN (cheap fix).** Add `.refine()` totalling `goal.length + role + variables.join("").length + constraints + examples ≤ 50_000` (or 64 KB serialized), and/or reject `Content-Length > 64 KiB` in the route before `c.req.json()`. |
| **L-1** | Low | **Stale success banner** after Evaluate/Optimize. `generate`/`save` call `setSuccess(null)`; `evaluate`/`optimize` do not, so “Saved to library.” remains visible while a new AI action runs (spec US-6: success text clears on next action). | `src/client/modules/PromptCreator.tsx:46-59`, `:61-81` vs `:83-94`, `:96-107` | **Yes** | **OPEN (trivial).** Add `setSuccess(null);` after `setError(null);` in both handlers. |
| **L-2** | Low | Error banner is announced politely (`role="status"`) instead of assertively; `ErrorText` never sets `role="alert"`. Axe passes (aria-live present), so this is a UX/AT-timing nit, not a compliance failure. | `src/client/components/ui.tsx:164-167` (`<Alert tone="error" …>`), default `role="status"` at `ui.tsx:128-146` | No | **OPEN (trivial).** `<Alert role="alert" tone="error" …>` in `ErrorText`. |
| **L-3** | Low (design) | **No auth middleware on `/api/ai/*` generation endpoints.** Only `/models` and `/test` do inline session checks (`routes/ai.ts:309-312`, `:352-356`). `/chat`, `/generate-prompt`, `/evaluate-prompt`, `/optimize-prompt`, `/generate-skill`, `/evaluate-skill`, `/optimize-skill`, `/compare-prompts`, `/research`, `/search-skills`, `/run-skill` are anonymous, protected only by the per-IP rate limiter (60/min for POST). Pre-existing behaviour, unchanged by this iteration; M-1 increases the cost-abuse ceiling. | `src/worker/routes/ai.ts:56,70,86,104,119,135,151,167,183,198,241`; limiter `src/worker/middleware/rateLimit.ts:19-52` | No | **Open (risk accepted or fix).** If anonymous demo use is intended, document it and keep the limiter; otherwise gate AI routes behind `auth.getSessionUser` and/or add a per-session AI budget. Note this is the documented “AI cost gate”. |
| **I-1** | Info | Session token persisted in `localStorage`. Blast radius of any future XSS; currently mitigated by CSP `connectSrc/scriptSrc 'self'` and zero HTML injection sinks. | `src/client/lib/auth.ts:5,13`; CSP `src/worker/middleware/security.ts:7-13` | No | Accepted for now; consider HttpOnly `Secure` cookie + CSRF token later. |
| **I-2** | Info | Working tree not clean (Gate 3 test/doc artefacts uncommitted; no product code). `.gitignore` also hides `*.log`, so Gate-4 logs need `git add -f`. | `git status --porcelain -uall` (45 entries at audit time; only `tests/e2e/flows.spec.ts` + `docs/orchestration_progress.md` modified) | n/a | Commit test-only + evidence artefacts per AGENTS.md. |

**No new outbound origins, no secret logging, no injection sink, and no dependency vulnerability were introduced by this iteration.**

---

## 2. Security verification matrix

| Check | Result | Evidence |
|---|---|---|
| `npm audit --omit=dev` | **PASS** — 0 vulnerabilities | `iter2-gate4-npm-audit.log` (exit 0) |
| `npm audit` (incl. devDependencies) | **PASS** — 0 vulnerabilities (no dev-only advisories to distinguish) | same log, second block |
| No new outbound origins; CSP `connectSrc` stays `'self'` | **PASS** — `middleware/security.ts` untouched by the diff; only fetches are `api.ts` same-origin, `fetchTimeout`→provider, `/models`,`/test` (user-supplied, see H-1), `ASSETS.fetch` | `security.ts:8-12`; `grep fetch(` results |
| Secrets not logged | **PASS** — no `console.*` of key/headers/token in worker or client; `mapOutboundError` logs only the thrown cause (upstream text ≤200 chars, never the Authorization header); `resolveAiConfig` logs only settings-load failures | `lib/outboundError.ts:11-13`; `services/ai.ts:69-77`; `grep console.` |
| Context fields cannot inject into provider URL/headers | **PASS** — URL = `${cfg.baseUrl}/chat/completions`, headers built only from `cfg.apiKey`; context is serialized into `messages[].content` only | `services/ai.ts:83-97`, `:160-181` |
| Zod bounds enforced server-side (`MAX_TEXT` 20k, variables ≤50, non-empty entries) | **PASS per-field** — 20,001-char role and 51 variables and `[""]` all rejected; 50×20k accepted → aggregate gap M-1 | `schemas.ts:5,20,92-98`; `iter2-gate4-context-bounds.log`; `tests/unit/schemas.test.ts:45-87` |
| Rate limiter still fails closed | **PASS** — missing `CACHE` ⇒ 503 for POST/PUT/PATCH/DELETE before any work; reads (idempotent) fail open, documented | `rateLimit.ts:19-37`; `tests/unit/rateLimit.test.ts` |
| Error mapping still generic 502, no upstream reflection | **PASS on generation path** — every AI catch → `mapOutboundError` ⇒ `{ok:false,error:"Upstream AI error"}` 502, cause server-logged; `app.onError` returns generic 500 | `lib/outboundError.ts:3-13`; `routes/ai.ts:61-83`; `worker/index.ts:22-27`; `tests/unit/outboundError.test.ts:34-64` |
| Auth middleware applied to `/api/ai/*` | **FAIL (pre-existing)** — no `app.use` auth; inline checks only on `/models`/`/test`; generation endpoints anonymous | see **L-3** |
| Client body omits empty fields | **PASS** — `buildContext()` trims and skips empties; `api.aiGeneratePrompt` only assigns non-empty fields; goal-only body is `{goal}` | `PromptCreator.tsx:24-44`; `api.ts:64-76` |
| Token not leaked to DOM/logs | **PASS (with I-1)** — token read from storage only to build the `Authorization` header; never rendered, never `console.log`ged in client code | `api.ts:7-15`, `client/lib/auth.ts:1-23` |
| XSS: generated content rendered as text | **PASS** — no `dangerouslySetInnerHTML`/`innerHTML` anywhere in `src/client`; result is a controlled `<Textarea value={result}>`; evaluation text is `<pre>{evalInfo}</pre>`; React escapes both. `PromptCreator` does not use `ResultPanel`, but `ResultPanel` itself renders `{children}` only | `PromptCreator.tsx:163,190`; `components/ui.tsx:211-224`; repo-wide grep |
| Navigation regrouping (`App.tsx`) introduced no sinks/links | **PASS** — only `onClick` state transitions; no `href`, `target=_blank`, `window.*`, or HTML injection | `App.tsx:189-289` |

### Confirmed vulnerability detail — H-1 (exact path)

```
src/worker/routes/ai.ts:307  app.post("/models", ...)
  :309-312  session check (any authenticated user)
  :315-316  baseUrl = caller-controlled, only trim()
  :319      apiKey = body.apiKey || c.env.OPENAI_API_KEY      <-- operator secret
  :320      url = `${baseUrl}/models`
  :322      headers.Authorization = `Bearer ${apiKey}`
  :323      fetch(url, { method: "GET", headers })            <-- SSRF + exfil
```
`/test` (`:351-398`) has the identical shape at `:367` (key) and `:380` (fetch). `services/ai.ts:86-90` already implements the correct rule for the generation path (`apiKeyFromSettings || isTrustedAiOrigin(...)`), so the fix is to reuse `isPublicHttpsUrl` (`lib/url.ts`) + `isTrustedAiOrigin`/`trustedProviderOrigins` (`services/aiProvider.ts`) here.

---

## 3. Performance

Full numbers and baseline comparison: `docs/evidence/iter2-gate4-bench.md`.

- Build exit 0, 3.45 s, 47 modules.
- **JS 187.77 kB raw / 56.12 kB gzip**; **CSS 37.25 kB raw / 7.27 kB gzip**.
- Delta vs pre-iteration `docs/evidence/build.log`: **JS +7.05 kB raw (+3.90 %), +1.48 kB gzip (+2.71 %)**; **CSS +2.63 kB raw (+7.60 %), +0.28 kB gzip (+4.01 %)**.
- **Dependencies: unchanged** — no `package.json`/lockfile diff in `57b6ad8`; `@vitest/coverage-v8` remains `--no-save` only (not in manifest).
- Composition cost: single O(total context chars) pass + one `join`, constant 2-message array, no extra network round-trip. No regressions measured at build level; the only runtime cost is upstream token count (see M-1).

**Verdict: PASS** (bundle growth is small, attributable, and within the iteration's UI scope).

---

## 4. Resilience matrix

| Failure mode | Expected behaviour | Verified by | Status |
|---|---|---|---|
| AI upstream 4xx/5xx | 502, `{ok:false,error:"Upstream AI error"}`, detail logged server-side only | `outboundError.test.ts:34-64` (re-run: pass); `outboundError.ts:11-13` | **PASS** |
| AI upstream network error / timeout (30 s) | same generic 502 | `fetchTimeout.ts` throw → same catch; covered by outbound tests | **PASS** |
| Rate limit exceeded | 429 `Rate limit exceeded` | `rateLimit.test.ts:90` (re-run: pass); `rateLimit.ts:49-51` | **PASS** |
| `CACHE` binding missing | 503 fail-closed for mutations (incl. all AI POSTs); reads only fail open | `rateLimit.ts:19-37`; unit coverage | **PASS** |
| Invalid body (types, 51 vars, 20,001-char field, empty variable) | 400 with zod message, no crash | `schemas.test.ts:45-87`; `iter2-gate4-context-bounds.log` | **PASS** |
| Max legal context (50 × 20k) | Parsed and composed without crash, but 1.08 MB forwarded upstream with no aggregate cap | probe log; `schemas.ts:92-98` | **PASS (no crash) / FAIL (no aggregate cap → M-1)** |
| Save failure (D1 down) | `catch` → `setError`, `finally` → `setLoading(false)`, `Alert tone="error"` | `PromptCreator.tsx:61-81`, `:164-167`; `tests/e2e/flows.spec.ts:5,94` (“API errors surface”) | **PASS** |
| Generation failure | loading cleared, error alert, stale success cleared | `PromptCreator.tsx:46-59`; E2E error-path test | **PASS** |
| Success text clears on next action | Cleared by generate/save, **not** by evaluate/optimize | `PromptCreator.tsx:49,64` vs `:83-107` | **PARTIAL → L-1** |
| Unhandled console/page errors | none in traced E2E runs | `iter2-gate3-console.log` (Gate 3) | **PASS** |

Targeted re-run: `npx vitest run tests/unit/outboundError.test.ts tests/unit/rateLimit.test.ts tests/unit/ai.test.ts` → **3 files / 15 tests pass, exit 0**. Full unit 52/52 and integration 3/3 also re-run green.

---

## 5. Gate 4 verdict per condition

| Gate 4 condition | Verdict |
|---|---|
| No known exploitable vulnerability introduced by the iteration | **PASS** (M-1 is a sizing/abuse gap, not an exploitable memory or injection flaw) |
| Dependency audit clean (prod and, distinctly, dev) | **PASS** — 0 / 0 |
| No new outbound origin; CSP intact | **PASS** |
| No secrets logged; no reflection of upstream detail on AI generation paths | **PASS** |
| Server-side zod bounds (per-field) | **PASS** — aggregate bound missing (M-1) |
| Rate limiter fails closed; 429 path intact | **PASS** |
| Auth on `/api/ai/*` | **FAIL (pre-existing, L-3)** |
| No pre-existing High/Critical open in audited surface | **FAIL (H-1)** |
| Performance within budget; no new dependencies | **PASS** |
| Resilience matrix green (failure modes handled) | **PASS**, one partial (L-1) |

### Verdict

**GATE 4: FAIL (conditional).**

The iteration diff itself is clean: no injection sinks, no new origins, no secret logging, no dependency change, ~+1.5 kB gzip, and every resilience path passes. It fails for two reasons that must be resolved before an unconditional pass:

1. **H-1 (High, pre-existing):** `/api/ai/models` and `/api/ai/test` still accept an arbitrary `baseUrl` and attach the deployment's `OPENAI_API_KEY` — a credential-exfiltration/SSRF gap that the earlier F1 remediation missed. Fix is ~6 lines in `src/worker/routes/ai.ts` reusing existing helpers.
2. **M-1 (Medium, introduced here):** no aggregate cap on the new context fields; 50×20k is accepted and forwarded upstream, ~54× the previous worst case on an anonymous, rate-limited route.

**Recommended unblocking sequence:** (a) patch H-1 as above and add a unit test asserting no `Authorization` header reaches a non-allowlisted host; (b) add the total-context `refine` (≤50–64 KB) plus a 400 test at 51×20k; (c) add `setSuccess(null)` to evaluate/optimize (L-1) and `role="alert"` to `ErrorText` (L-2); (d) decide and document the anonymous-AI policy (L-3). Re-running this gate afterwards should flip it to **PASS** without further product changes.
