# AGENTS.md — migrations

## Scope
D1 SQL migrations, applied by wrangler (`migrations_dir = "migrations"` in `wrangler.toml`):
- `0001_init.sql` — `prompts`, `templates`, `skills`, `evaluations`, `settings`
- `0002_auth.sql` — `users`, `sessions` (+ session indexes)

## Rules
- Name files `NNNN_description.sql` and keep numbering strictly sequential; wrangler applies in order and tracks state.
- Never edit an already-applied migration — add a new one; keep table/column names in sync with `src/worker/db/*` and Zod bounds in `src/worker/schemas.ts`.
- Apply: local `npx wrangler d1 migrations apply DB --local`; remote `npx wrangler d1 migrations apply prompt-engine-db --remote`. Migrations must run before the first `npm run dev` or every API call fails with "no such table".
