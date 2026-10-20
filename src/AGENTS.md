# AGENTS.md — src

## Boundary
- `client/` — React frontend (Vite). No secrets, no provider keys ever reach the browser; all AI calls go through the Worker `/api`.
- `worker/` — Cloudflare Worker (Hono). Entry `worker/index.ts`.
- `shared/` — framework-free TypeScript types, imported everywhere via `@shared/*` (tsconfig paths + Vite alias).

## Verification
- `npm run typecheck` — `tsc -b` over `tsconfig.base.json` (strict) + client + worker project configs.
- `npm run lint` — eslint flat config.
- Unit tests may colocate here (vitest matches `src/**/*.test.*`) but currently live in `tests/unit/`.
