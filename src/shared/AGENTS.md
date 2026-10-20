# AGENTS.md — src/shared

## Scope
Framework-free shared types only: `types.ts` defines `Prompt`, `Template`, `Skill`, `Evaluation`, `AiMessage`, `WebSearchResult`, `SkillCandidate`, `SearchSkillResult`, `SkillSearchResponse`, and the response envelope `ApiResponse<T>` (`{ ok: true, data }` | `{ ok: false, error }`) used by both client `lib/api.ts` and worker routes.

## Rules
- No runtime dependencies, no env access — types only.
- Import from anywhere as `@shared/types` (alias configured in `tsconfig.base.json` and `vite.config.ts`).
- If you change a type here, typecheck will surface every consumer; fix them before pushing.
