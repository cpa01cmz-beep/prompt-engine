# Setup

How to run, test, and deploy the Prompt Engine + Skills Engine locally. Commands are the ones defined in `package.json`, `wrangler.toml`, and `.github/workflows/ci.yml`.

## Prerequisites

| Requirement | Version / source |
| --- | --- |
| Node.js | 24 (`.nvmrc`); `package.json` requires `>=22` |
| npm | Bundled with Node (repo has `package-lock.json`) |
| Cloudflare account | Only needed for remote deploys (`wrangler`) |
| Wrangler | Installed as a dev dependency (`wrangler ^4`), run via `npx` |

```bash
nvm use            # reads .nvmrc → Node 24
node --version
```

## Install

```bash
npm install
```

## Configure environment

`wrangler.toml` already sets non-secret defaults:

```toml
[vars]
OPENAI_BASE_URL = "https://opencode.ai/zen/v1"
OPENAI_MODEL = "deepseek-v4.1-flash-free"
```

`.env.example` is a reference file — nothing in the repo loads it automatically:

```bash
OPENAI_BASE_URL=https://opencode.ai/zen/v1
OPENAI_MODEL=deepseek-v4.1-flash-free
OPENAI_API_KEY=
```

> **Note (updated)**: `.env.example` now lists `deepseek-v4.1-flash-free`, matching `wrangler.toml` and the code default in `src/worker/services/ai.ts:8`. It previously listed `deepseek-v4-flash-free`, which is not a model the provider exposes. Treat `wrangler.toml` / the code as authoritative.

Worker-side variables and secrets (`src/worker/env.ts`):

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_BASE_URL` | no (default set) | OpenAI-compatible base URL; `/chat/completions` is appended |
| `OPENAI_MODEL` | no (default set) | Model id sent with every request |
| `OPENAI_API_KEY` | no | Bearer token for the provider; empty means unauthenticated calls |
| `AI_PROVIDER_ALLOWLIST` | no | Comma-separated extra `https://` origins trusted for settings-based provider overrides |

Local secrets: Wrangler reads `.dev.vars` for `wrangler dev`. That file is **not** covered by `.gitignore` today (only `.env` and `.env.*` are), so add an ignore entry before creating it. Production secrets use `npx wrangler secret put OPENAI_API_KEY`.

Bindings required by the app (`wrangler.toml`): `DB` (D1), `CACHE` (KV), `ASSETS` (static assets). The rate limiter fails closed (HTTP 503) for mutating requests if `CACHE` is missing.

## Local development

```bash
npm run dev
```

Runs in parallel (`concurrently`):

- `vite` — React client on <http://localhost:5173>
- `wrangler dev` — Worker/API on <http://localhost:8787> (the Vite dev server proxies `/api` there, see `vite.config.ts`)

Open <http://localhost:5173>. The first request seeds a default admin user: **username `admin`, password `admin123`** (`ensureDefaultAdmin` in `src/worker/db/auth.ts`, only when the `users` table is empty). Change it from the Settings dialog after first login.

## D1 migrations

Local (what CI uses):

```bash
npx wrangler d1 migrations apply DB --local
```

Remote:

```bash
npx wrangler d1 migrations apply prompt-engine-db --remote
```

Migrations live in `migrations/` (`migrations_dir = "migrations"`):

- `0001_init.sql` — `prompts`, `templates`, `skills`, `evaluations`, `settings`
- `0002_auth.sql` — `users`, `sessions` + session indexes

Run migrations before the first `npm run dev`, otherwise API calls fail with “no such table” errors.

## Build

```bash
npm run build      # vite build → dist/client (served by the Worker's ASSETS binding)
```

The Worker entry is `src/worker/index.ts`; the client build output directory (`dist/client`) must match `[assets] directory` in `wrangler.toml`.

## Tests

| Command | Config | Scope |
| --- | --- | --- |
| `npm run test:unit` | `vitest.config.ts` (jsdom) | `src/**/*.test.ts(x)` + `tests/unit/**` |
| `npm run test:integration` | `vitest.integration.config.ts` (node) | `tests/integration/**` — calls the Hono app directly with stub bindings |
| `npm run test:e2e` | `playwright.config.ts` | `tests/e2e/**` on chromium, firefox, webkit |

Quality gates used by CI: `npm run lint`, `npm run typecheck` (`tsc -b`), `npm run build`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`.

### Playwright notes

- First local run needs browsers: `npx playwright install --with-deps`.
- `webServer` runs `npm run dev` and waits for <http://localhost:5173> (120 s timeout); `reuseExistingServer` is on outside CI, so a running dev server is reused and must be healthy.
- Base URL is `http://localhost:5173`; traces are retained on failure and the HTML report is written to `playwright-report/`.
- CI retries twice and uploads the report on failure; locally retries are 0.
- E2E specs stub API calls (`tests/e2e/helpers.ts`, `fixtures.ts`), so no AI key or live provider is needed.

## Deploy

```bash
npm run build
npx wrangler deploy
```

`package.json` has no `deploy` script (the README’s `npm run deploy` note is not wired). Apply remote migrations and set secrets before the first deploy:

```bash
npx wrangler d1 migrations apply prompt-engine-db --remote
npx wrangler secret put OPENAI_API_KEY
```

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `503 { ok:false, error:"Service temporarily unavailable" }` on POST/PUT/DELETE | `CACHE` KV binding missing — mutations fail closed | Check `[[kv_namespaces]]` in `wrangler.toml`; restart `wrangler dev` |
| `502 { ok:false, error:"Upstream AI error" }` | Provider unreachable, bad base URL/model, or timeout (30 s) | Check `OPENAI_BASE_URL`/`OPENAI_MODEL`, the Settings → provider override, and the Network tab; the concrete cause is logged in the Wrangler console |
| `401 Unauthorized` | Missing/expired session token | Log in again; the token is stored in `localStorage` under `auth.token` |
| `400 { ok:false, error: ... }` from `/api/prompts` | `title` or `content` empty/too long (title ≤300, text ≤20 000 chars) | Trim the payload |
| `D1_ERROR: no such table: prompts` | Migrations not applied locally | `npx wrangler d1 migrations apply DB --local` |
| `ECONNREFUSED` on `/api/...` from the browser | Worker not running | `npm run dev` starts both processes; check the `worker` pane |
| Playwright: “browser is not installed” | Browsers missing | `npx playwright install --with-deps` |
| Playwright hangs waiting for the web server | Port 5173 occupied by a stale process | Stop it or let `reuseExistingServer` attach to a healthy instance |
| `tsc -b` stale errors after file moves | Incremental build info | Delete `*.tsbuildinfo` and re-run `npm run typecheck` |
| Lint reports errors in build output | — | `eslint.config.js` already ignores `dist`, `.wrangler`, `node_modules`, `playwright-report`, `test-results` |

## Related docs

- [Architecture](architecture.md)
- [API reference](api.md)
- [User flows](user-flows.md)
