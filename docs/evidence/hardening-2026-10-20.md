# Backend hardening — 2026-10-20

Follow-up to `audit-2026-10-20.md`. Changes are code-only; no infrastructure changes.

## Changes

- SSRF hardening (`P0-1/2`): AI provider config now comes only from a vetted `ai.provider` setting (https-only, public hosts, no credentials, length caps) via `src/worker/services/aiProvider.ts` + `src/worker/lib/url.ts`; legacy `OPENAI_*` settings keys are ignored by `src/worker/services/ai.ts`. Settings writes restricted to the `ai.provider` key (`WRITABLE_KEYS` in `src/worker/routes/settings.ts`) and the value must pass `parseAiProvider` or the request is rejected with 400.
- Outbound fetch timeouts (`P1-4`): `src/worker/lib/fetchTimeout.ts` wraps chat/Search/search-skills fetches with AbortController timeouts (30s chat, 10s search).
- Payload limits (`P1-5`): bounded schema fields in `src/worker/schemas.ts` (20 KiB text, 300 title/search caps, 50-item arrays, 40-message chat cap, 32 KiB JSON for `run-skill`/`feedback`/settings value).
- Rate limiter (`P1-6`): trusts only `cf-connecting-ip` (no spoofable header fallbacks), separate read (240/min) and write (60/min) buckets, shared anonymous bucket without a trusted IP.
- API 404 (`P1-8`): `src/worker/index.ts` returns JSON 404 for unmatched `/api/*` before the static-asset fallback.
- Search-skills output (`P1-9`): model output parsed once via `parseJsonFromText` and validated with `SkillCandidatesSchema`; malformed output yields `[]` instead of raw model text.
- Web search input (`P2`): `/api/search/web` caps `q` at 500 chars.
- LIKE injection (`P2-11`): search terms escaped for `LIKE ... ESCAPE '\\'` in prompts/skills/templates (`src/worker/db/utils.ts`).
- Array columns (`P2-12/13`): `parseStringArray` validates element types; list endpoints accept `limit` capped at 200 (default 100) across prompts/skills/templates/evaluations.
- Types (`P2-14`): `Env.ASSETS` typed optional to match runtime check in `index.ts`.
- A11y (`P2-16`): settings modal gains ESC-to-close, focus trap, initial focus, and focus restore.
- Tests: new `tests/unit/hardening.test.ts` (URL/provider/LIKE/array/limit validators), integration case for JSON 404 on unmatched `/api/*`.

## Not actionable in code

- `wrangler.toml` zero database_id/KV id: real IDs must be provisioned per environment (`wrangler d1 create`, `wrangler kv namespace create`). Unchanged.

## Quality gates (local run)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | PASS (0 errors) |
| Lint | `npm run lint` | PASS (0 errors/warnings) |
| Unit tests | `npm run test:unit` | PASS (4 files, 17 tests) |
| Integration | `npm run test:integration` | PASS (1 file, 3 tests) |
| Build | `npm run build` | PASS (Vite, ~180 KB JS) |
