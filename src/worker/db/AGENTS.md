# AGENTS.md — src/worker/db

## Scope
Only place that touches D1 directly. One module per table: `prompts.ts`, `templates.ts`, `skills.ts`, `evaluations.ts`, `settings.ts` (key/value; `*.Typed` variants JSON-roundtrip a value), `auth.ts` (PBKDF2-SHA256 password hashing 100k iters, session create/get/delete, `ensureDefaultAdmin` seeds admin/admin123 when `users` is empty). `utils.ts`: `nowIso`, `newId`, `clampListLimit`, `escapeLike`, `parseStringArray`.

## Rules
- CRUD signatures are uniform: `list(db, search?, limit?)`, `get(db, id)`, `create(db, input)`, `update(db, id, partial)`, `delete(db, id)` — keep new tables consistent.
- Pass the raw `D1Database` binding in; never construct queries outside this folder.
- Sanitize search input with `escapeLike` and page with `clampListLimit`.
- Schema changes require a new migration in `migrations/` (never edit applied ones).

## Verification
`npm run test:unit` (utils + auth covered) and `npm run test:integration`.
