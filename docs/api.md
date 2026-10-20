# API reference

Verified against `src/worker/index.ts` and `src/worker/routes/*.ts`. All paths are relative to the Worker origin (e.g. `https://your-host/api/...`).

## Conventions

- **Envelope**: JSON responses use `{ ok: true, data }` on success and `{ ok: false, error }` on failure, except `GET /api/health`, which returns `{ status: "ok" }`.
- **Auth**: protected endpoints expect `Authorization: Bearer <token>` (token from `POST /api/auth/login`).
- **Validation**: request bodies are validated with Zod. Invalid bodies return `400 { ok: false, error: <zod message> }`.
- **Rate limits** (KV-backed, per `cf-connecting-ip`): 60 requests/minute for mutating methods, 240/minute for reads. Over budget → `429 { ok: false, error: "Rate limit exceeded" }`. A missing `CACHE` binding fails closed (503) for mutations.
- **CORS**: dev origins `localhost`/`127.0.0.1` on ports 5173 and 8787, plus same-origin requests.
- **Timeouts**: AI provider calls abort after 30 s and surface as `502 { ok: false, error: "Upstream AI error" }`.

## AI — `POST /api/ai/generate-prompt`

Generates a prompt from a goal with optional context.

**Auth**: none enforced server-side (the client still sends the Bearer token); `401` is not returned by this route today.

**Request body**

```json
{
  "goal": "string (required, 1–20000 chars)",
  "role": "string (optional, ≤20000 chars)",
  "variables": ["string (optional, ≤50 items, each ≤20000 chars)"],
  "constraints": "string (optional, ≤20000 chars)",
  "examples": "string (optional, ≤20000 chars)"
}
```

**Field and aggregate bounds** (`src/worker/schemas.ts`)

| Bound | Limit | Source |
| --- | --- | --- |
| `goal` | required, 1–20,000 chars | `src/worker/schemas.ts:5,119` |
| `role`, `constraints`, `examples` | optional, ≤ 20,000 chars each | `src/worker/schemas.ts:120,122-123` |
| `variables` | optional, ≤ 50 items, each ≤ 20,000 chars | `src/worker/schemas.ts:121` |
| **Total context** — `goal` + `role` + `constraints` + `examples` + `variables` joined with `", "` | **≤ 64,000 chars** | `src/worker/schemas.ts:12,30-45,125-134` |

Per-field caps alone would still admit roughly 2.7 MB of valid input, so the composed context is bounded at the validation boundary too. A body over the aggregate cap fails Zod validation and returns `400 { ok: false, error: <zod message> }` (`src/worker/routes/ai.ts:78`); the message contains `Total context is <n> characters; the limit is 200000`.

**Success** — `200 { "ok": true, "data": { "content": "<generated prompt>" } }`

**Errors**

| Status | Body | Cause |
| --- | --- | --- |
| 400 | `{ ok: false, error }` | Zod validation failure (missing/invalid `goal`, bounded-field violation, or total context over the 200,000-char cap) |
| 429 | `{ ok: false, error: "Rate limit exceeded" }` | Global rate limit exceeded |
| 502 | `{ ok: false, error: "Upstream AI error" }` | Provider/network failure or timeout (details logged server-side) |
| 500 | `{ ok: false, error: "Internal server error" }` | Unhandled worker error |

**Message composition**: `buildCreatePromptMessages(goal, ctx)` emits a system message plus a user message containing the goal followed by labeled sections in order: `Role:`, `Variables:`, `Constraints:`, `Examples:`. With no context, the user message is the goal alone.

**Client helper**: `api.aiGeneratePrompt(goal, ctx?)` in `src/client/lib/api.ts` serializes only non-empty fields; `variables` are split on commas, trimmed, and capped at 50.

## AI — `POST /api/ai/generate-skill` (unchanged)

**Request body**: `{ "goal": "string (required)" }` (1–20000 chars).

**Response**: `{ ok: true, data: { content, skill } }` where `skill` is the model's structured output validated against `SkillDefinitionSchema`, or `null` when the model output does not parse.

## Other AI endpoints

All are `POST`, mount under `/api/ai`, accept JSON, return the standard envelope. Auth is required for `/models` and `/test` only.

| Method | Path | Auth | Request body | Response `data` |
| --- | --- | --- | --- | --- |
| POST | `/api/ai/chat` | none | `{ messages: AiMessage[] }` (1–40) | `{ content }` |
| POST | `/api/ai/evaluate-prompt` | none | `{ prompt }` | `{ content, evaluation }` (`evaluation` may be `null`) |
| POST | `/api/ai/optimize-prompt` | none | `{ prompt }` | `{ content }` |
| POST | `/api/ai/compare-prompts` | none | `{ promptA, promptB }` | `{ content, comparison }` (`comparison` may be `null`) |
| POST | `/api/ai/research` | none | `{ topic, domain? }` | `{ content }` |
| POST | `/api/ai/search-skills` | none | `{ query }` (≤500 chars) | `{ content, results, candidates, webSearchUnavailable }` |
| POST | `/api/ai/run-skill` | none | `{ skill, input? }` | `{ content }` |
| POST | `/api/ai/evaluate-skill` | none | `{ skill }` | `{ content, evaluation }` (`evaluation` may be `null`) |
| POST | `/api/ai/optimize-skill` | none | `{ skill }` | `{ content, skill }` (`skill` may be `null`) |
| POST | `/api/ai/models` | Bearer | `{ baseUrl, apiKey? }` | `{ models: string[] }`; `400` if `baseUrl` missing; `502 { ok:false, error: "Upstream error <status>" }`; `400 { ok: false, error: "baseUrl must be a public https URL" }` if `baseUrl` is not a public HTTPS URL; `403 { ok: false, error: "baseUrl origin is not allowed" }` if the origin is untrusted and no caller `apiKey` is supplied |
| POST | `/api/ai/test` | Bearer | `{ baseUrl, model, apiKey?, mode?, goal? }` | `{ status }` on success. On upstream failure returns `{ ok: false, error: "HTTP <status>: <text>" }` with HTTP 200 (no explicit status code). `400` if `baseUrl` or `model` missing. Also `400 { ok: false, error: "baseUrl must be a public https URL" }` if `baseUrl` is not a public HTTPS URL; `403 { ok: false, error: "baseUrl origin is not allowed" }` if the origin is untrusted and no caller `apiKey` is supplied. |

### `baseUrl` trust boundary

Both `POST /api/ai/models` and `POST /api/ai/test` accept a caller-supplied `baseUrl`; `resolveBaseUrl` (`src/worker/routes/ai.ts:314-325`) gates it **before** any outbound fetch:

| Check | Condition | Result |
| --- | --- | --- |
| Shape | Not a public `https://` URL — non-HTTPS, `localhost`, private/reserved IP literals, embedded credentials, or longer than 2048 chars (`isPublicHttpsUrl`, `src/worker/lib/url.ts:1,38-55`) | `400 { ok: false, error: "baseUrl must be a public https URL" }` (`src/worker/routes/ai.ts:316-317`) |
| Origin trust | Origin is neither operator-trusted (`OPENAI_BASE_URL` / `AI_PROVIDER_ALLOWLIST`, `src/worker/services/aiProvider.ts:15-24,27-38`) **nor** accompanied by a caller-supplied `apiKey` | `403 { ok: false, error: "baseUrl origin is not allowed" }` (`src/worker/routes/ai.ts:321-323`) |

Order of checks: bearer auth → `401 { ok: false, error: "Unauthorized" }` (`src/worker/routes/ai.ts:337,339` and `:380,382`), required fields → `400` (`:342`, `:393-394`), `resolveBaseUrl` → `400`/`403` (`:344`, `:397`), then the outbound fetch (`:349`, `:409`). For loopback and metadata targets the request is rejected with `localServerHits=0` and `outboundFetchCalls=0` (`docs/evidence/iter2-gates-4-final-report.md`).

The operator's `OPENAI_API_KEY` is attached only to trusted origins: the resolver returns `apiKey: callerKey || env.OPENAI_API_KEY || ""` (`src/worker/routes/ai.ts:324`), which is reached only when the origin is trusted or the caller supplied their own key — the env provider key is never sent to an untrusted origin. A caller can still point the Worker at any public HTTPS origin, but only with **their own** key.

## Prompts — `/api/prompts`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/prompts` | none | List prompts (`?q=` searches title/content; `?limit=` caps, default 100). Returns `Prompt[]`. |
| GET | `/api/prompts/:id` | none | Get one prompt (`404` if missing). |
| POST | `/api/prompts` | none | Create a prompt. Body: `PromptInputSchema` (`title`+`content` required; optional `role`, `variables`, `constraints`, `examples`, `tags`). Returns `201`. |
| PUT | `/api/prompts/:id` | none | Partial update (`PromptUpdateSchema`). Returns `404` if missing. |
| DELETE | `/api/prompts/:id` | none | Delete. Returns `{ ok: true, data: null }` (`404` if missing). |

## Templates — `/api/templates`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/templates` | none | List templates (`?q=`, `?limit=`). |
| GET | `/api/templates/:id` | none | Get one (`404` if missing). |
| POST | `/api/templates` | none | Create (`name`+`body` required; optional `variables`). Returns `201`. |
| PUT | `/api/templates/:id` | none | Partial update. |
| DELETE | `/api/templates/:id` | none | Delete. |
| POST | `/api/templates/:id/render` | none | Render `{{var}}` placeholders. Body may be `{ variables: {...} }` or a flat object; query params also accepted. Returns `{ rendered, missing }`. |
| GET | `/api/templates/:id/render` | none | Same, variables from query params only. |

## Skills — `/api/skills`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/skills` | none | List skills (`?q=`, `?limit=`). |
| GET | `/api/skills/:id` | none | Get one (`404` if missing). |
| POST | `/api/skills` | none | Create (`name` required; optional `description`, `instructions`, `tools`, `examples`, `tags`). Returns `201`. |
| PUT | `/api/skills/:id` | none | Partial update. |
| DELETE | `/api/skills/:id` | none | Delete. |

## Evaluations — `/api/evaluations`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/evaluations` | none | List (`?targetType=`, `?targetId=`, `?limit=`). |
| GET | `/api/evaluations/:id` | none | Get one (`404` if missing). |
| POST | `/api/evaluations` | none | Create (`targetType` ∈ {prompt, skill}, `targetId` required; optional `score` 0–100, `feedback`, `model`). Returns `201`. |

## Settings — `/api/settings`

All routes require a Bearer token.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/settings` | Bearer | List all settings (`{ ok, data: { key: value, … } }`). |
| GET | `/api/settings/:key` | Bearer | Get one (`404` if missing). |
| PUT | `/api/settings/:key` | Bearer | Upsert. `400 { error: "Key not allowed" }` unless key is one of `ai.provider`, `ai.providers`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`. Value body `{ value }` (JSON). `ai.provider` must be `{ baseUrl, model }` pointing at a public HTTPS URL. Value capped at 16 KB. |

## Auth — `/api/auth`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | none | `{ username, password }` → `{ token, user }`. Returns `400` on invalid shape, `401` on bad credentials. Creates the default admin (`admin` / `admin123`) when no users exist. |
| GET | `/api/auth/me` | Bearer | Current user `{ id, username, role }`. |
| POST | `/api/auth/logout` | none (token optional) | Deletes the session; returns `{ ok: true }`. |
| POST | `/api/auth/change-password` | Bearer | `{ currentPassword, newPassword (≥6) }`. |
| POST | `/api/auth/users` | Bearer (admin) | Create a user `{ username, password (≥6), role? }` → `201`. Returns `403` for non-admins. |

## Search — `/api/search`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/search/web?q=` | none | Web search. `400` if `q` missing or longer than 500 chars. Returns `{ query, results }`. `502` on upstream DuckDuckGo failure. |

## Health — `/api/health`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | none | Returns `{ status: "ok" }` with HTTP 200. |

## Error summary

| Status | Meaning |
| --- | --- |
| 200 | Success (or the `/test` route reporting an upstream failure in the body) |
| 201 | Created (prompts, skills, templates, evaluations, users) |
| 400 | Validation failure / bad input |
| 401 | Missing/invalid Bearer token (auth-gated routes) |
| 403 | Forbidden (non-admin user management) |
| 404 | Not found (including unmatched `/api/*`) |
| 429 | Rate limit exceeded |
| 502 | Upstream AI/web failure |
| 503 | Mutating request with no `CACHE` binding |
| 500 | Unhandled worker error |

## Related docs

- [Architecture](architecture.md) — request flow, message composition, D1 save path
- [Setup](setup.md) — local dev, migrations, tests
- [User flows](user-flows.md) — end-to-end journeys
