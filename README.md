# prompt-engine

Cloudflare-native **Prompt Engine + Skills Engine**: a React/Vite client served by a Hono based Cloudflare Worker, backed by D1 migrations, with AI provider integration and integrated skills (model JSON parsing, rate limiting, outbound error hardening).

## Stack

- **Runtime:** Node 24 (`.nvmrc`), TypeScript (strict), Vite, eslint 9 flat config
- **Worker:** [Hono](https://hono.dev/) on Cloudflare Workers (`src/worker`, config in `wrangler.toml`)
- **Client:** React 18 + Tailwind CSS 4 (`src/client`, config in `vite.config.ts`)
- **AI:** providers resolved from settings storage (`src/worker/services`), validated with [Zod]

## Getting started

```bash
npm install
npm run dev          # vite client on :5173 + wrangler dev in parallel
```

## Quality gates

All commands must pass before pushing (see [CONTRIBUTING](CONTRIBUTING.md)):

| Command | What it does |
| --- | --- |
| `npm run lint` | eslint flat config |
| `npm run typecheck` | `tsc -b` across base/client/worker tsconfigs |
| `npm run build` | production client build |
| `npm run test:unit` | vitest unit tests (`tests/unit`) |
| `npm run test:integration` | vitest integration tests (`tests/integration`) |
| `npm run test:e2e` | Playwright across chromium/firefox/webkit (runs `npm run dev` automatically) |

GitHub Actions runs all of the above on every push to `main` and every PR (`.github/workflows/ci.yml`).

## Deployment

```bash
npm run deploy   # not wired yet — use npx wrangler deploy for now
```

## Governance

- `LICENSE` — MIT
- `SECURITY.md` — vulnerability reporting
- `CONTRIBUTING.md` — workflow, conventions, evidence policy
- `CODEOWNERS` — review routing
- `AGENTS.md` files per folder — coding conventions kept next to the code
- Quality-gate evidence lives under `docs/evidence/`
