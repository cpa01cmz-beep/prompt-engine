# AGENTS.md

## Project
Cloudflare-native **Prompt Engine + Skills Engine**: React/Vite client served by a Hono Cloudflare Worker (entry `src/worker/index.ts`), D1 (binding `DB`) for data, KV (`CACHE`) for rate limiting, built assets served from `dist/client`. Deeper docs: `docs/architecture.md`, `docs/api.md`, `docs/setup.md`.

## Conventions (from CONTRIBUTING.md)
- **AGENTS.md is law**: every folder carries one; read it before editing files there, and add one when creating a folder. Keep each file to rules an agent would otherwise miss.
- Commit and push after every valuable change. Imperative, conventional-commit prefixes as in history: `fix(scope): …`, `feat(scope): …`, `chore: …`, `docs: …`.
- `main` is protected — no force pushes, CI required before merge.
- TypeScript strict mode (`tsconfig.base.json`); keep functions small and tested. Use the `@shared/*` alias for `src/shared/*` types (tsconfig paths + Vite alias).
- Store quality-gate evidence (logs, audit notes, dated one file per event) under `docs/evidence/`.

## Commands
- `npm run dev` — vite on :5173 + `wrangler dev` on :8787 in parallel; vite proxies `/api` to :8787. Open **:5173**, not :8787.
- Gates in CI order: `lint` → `typecheck` (`tsc -b`) → `build` → `test:unit` → `test:integration`; `test:e2e` runs as a separate CI job.
- Stale `tsc -b` errors after moving files: delete `*.tsbuildinfo` and re-run.
- There is **no `npm run deploy`** script: `npm run build && npx wrangler deploy`.
- Node 24 (`.nvmrc`); e2e needs `npx playwright install --with-deps`.

## First-run setup
- Apply D1 migrations before first `npm run dev`, or API calls fail with "no such table": `npx wrangler d1 migrations apply DB --local` (remote: `npx wrangler d1 migrations apply prompt-engine-db --remote`).
- First request seeds default admin `admin` / `admin123` (`ensureDefaultAdmin` in `src/worker/db/auth.ts`) — change it in Settings after first login.
- No `.env` file is auto-loaded. Local secrets for `wrangler dev` go in `.dev.vars`, which is **not** gitignored — add an ignore entry before creating it. Deploy secrets: `npx wrangler secret put OPENAI_API_KEY`.

## Testing quirks
- Unit (`vitest.config.ts`): jsdom, globals on, `tests/setup.ts` loads jest-dom; matches `src/**/*.test.*` and `tests/unit/**`.
- Integration (`vitest.integration.config.ts`): imports the Hono app and runs it **in-process with a mock env** — no live worker, D1, or services needed.
- E2E: Playwright over chromium/firefox/webkit; starts `npm run dev` itself (fails if :5173 is busy only in CI). `workers: 1` on purpose — WebKit stalls under parallel load on small runners. Videos off; traces carry failure evidence (`playwright-report/`).

## API / security rules
- Envelope everywhere: `{ ok: true, data }` / `{ ok: false, error }`.
- **Never surface upstream/API error bodies** — use the shared `mapOutboundError` helper in catch blocks (contract: `tests/unit/outboundError.test.ts`).
- Bodies are Zod-bounded: TEXT ≤ 50 000, TITLE ≤ 300, arrays ≤ 50, JSON ≤ 32 KB; composed AI context ≤ `MAX_CONTEXT_CHARS` 200 000 (`src/worker/schemas.ts`).
- AI provider is OpenAI-compatible `chat/completions` (non-streaming), env `OPENAI_BASE_URL` / `OPENAI_MODEL` / `OPENAI_API_KEY`. `resolveBaseUrl` validates caller-supplied baseUrls (SSRF guard) — the env key is attached only to trusted origins. Optional `AI_PROVIDER_ALLOWLIST` (comma-separated `https://` origins).
- Rate limiter **fails closed**: mutating requests → 503 when the `CACHE` KV binding is missing.

## Gotchas
- `.gitignore` ignores `docs/` and `.opencode/` for *new* files — conventionally-tracked files there need `git add -f`.
- Middleware order in `src/worker/index.ts` is `securityHeaders` → `cors` → `rateLimit`, applied to every route.
- Feature branches: CI accepts pushes to `main` and all PRs; keep PRs small even solo (review overhead is zero).
- `.opencode/agents/` holds ~104 agency subagents installed from `msitarzewski/agency-agents` (see `.opencode/AGENTS.md`); OpenCode caps at ~119 agents.
