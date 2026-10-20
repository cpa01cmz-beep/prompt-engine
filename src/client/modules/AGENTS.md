# AGENTS.md — src/client/modules

## Scope
The 14 feature screens, all imported and wired in `../App.tsx` (there is no router):
PromptCreator, PromptEvaluator, PromptOptimizer, PromptCompare, PromptLibrary, PromptTemplates, PromptResearch / SkillSearch, SkillResearch, SkillCreator, SkillOptimizer, SkillEvaluator, SkillLibrary, SkillLab.
`PromptCreator` implements the canonical flow: Goal → Add context → Generate → Save.

## Rules
- Each file exports one feature component (named export; `PromptCompare` is aliased from `PromptCompare.tsx`).
- Cross-module state flows through `App.tsx` props or `../lib/api` — no globals.
- Destructive/long flows render `Spinner`/`Loading` from `../components/ui`.
