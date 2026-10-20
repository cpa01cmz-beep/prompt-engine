# AGENTS.md — src/worker/services

## Scope
AI orchestration:
- `ai.ts` — `getAiConfig`/`resolveAiConfig` (env + settings + provider override), `isTrustedAiOrigin`, `chatCompletion` (non-streaming `chat/completions` via `fetchWithTimeout`), `chatCompletionJSON` + `parseJsonFromText`, and one message builder per engine action: `buildCreatePromptMessages`, `build{Evaluate,Optimize}PromptMessages`, `buildComparePromptsMessages`, `build{Create,Evaluate,Optimize}SkillMessages`, `buildRunSkillMessages`, `buildResearchMessages`, `buildSearchSkillsMessages`.
- `aiProvider.ts` — user-writable provider overrides: `trustedProviderOrigins(env)`, `parseAiProvider(value, env)`; malformed values fall back to env config; secrets attach only to trusted origins.

## Rules
- Adding an engine action = add its `build*Messages` builder here + wire in `routes/ai.ts` + model-JSON schema in `../schemas` + unit tests (`ai-composition.test.ts`, `ai-json.test.ts` patterns).
- Provider/baseUrl changes must keep `tests/unit/ai.test.ts`, `ai-baseurl-guard.test.ts`, `hardening.test.ts` green.
