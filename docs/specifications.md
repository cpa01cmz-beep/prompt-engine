# Specifications — Automate, Simplify, Clarify (Iteration 2)

Status: APPROVED · Owner: Lead Systems Orchestrator · Date: 2026-10-20
Companion: `docs/phase1-research.md` (research evidence), `docs/orchestration_progress.md` (live state)

---

## 1. Problem statement

The app exposes 16 modules (7 Prompt + 7 Skill tiles + hub/login) with a flat grid. Users must guess which module to open next, and the **primary creation form silently discards user input**: `PromptCreator` renders Role, Variables, Constraints, Examples but calls `api.aiGeneratePrompt(goal)` — only the goal reaches the AI (`src/client/modules/PromptCreator.tsx:23,86-89`). Net effect: more manual steps, wasted input, unclear journey.

## 2. Goals & non-goals

**Goals**
1. Every input the creation form collects is used during generation (automation).
2. One obvious primary journey from landing to saved prompt (≤4 clicks), with advanced tools one level deeper (simplification).
3. User flows documented and testable end-to-end (clarity).

**Non-goals**: redesigning the whole design system; removing features; new providers/DB migrations; auth changes.

## 3. User stories (accepted)

| ID | Story | Acceptance (Given/When/Then) |
|---|---|---|
| US-1 | As a new user, I understand the first action immediately. | Given I open `/`, then I see a primary "Start creating a prompt" action within the first viewport and a 4-step journey summary (Create → Evaluate → Optimize → Save). |
| US-2 | As a prompt author, my context fields are used. | Given I fill Goal, Role, Variables (comma-separated), Constraints, Examples, when I click Generate, then the request body contains `goal` + non-empty context fields, the composed AI message includes each provided section, and the result renders in the result panel. |
| US-3 | As a prompt author, blank context changes nothing. | Given only Goal is filled, when I Generate, then the outgoing body contains `{goal}` only and generation succeeds exactly as before (no regression). |
| US-4 | As a returning user, navigation is obvious. | Given the app loads, then modules are grouped: a "Create" primary journey (Creator, Evaluator, Optimizer, Library) and Advanced/Manage groups; all 14 modules remain reachable by click. |
| US-5 | As a prompt author, I can keep my result. | Given a generated result, when I click Save, then it persists to the library and the library shows it. |
| US-6 | As a user, I get honest errors. | Given AI or save failures, then an Alert (tone=error) shows the `{ok:false,error}` message, success text clears on the next action, and no unhandled console errors occur. |

## 4. User flows

### Flow A — Create a prompt (primary)
1. Open `/` → hub/workspace view with primary CTA **Start creating a prompt** (`button` → selects `creator` module).
2. **PromptCreator**: enter **Goal** (required). Optionally expand **Add context** and fill Role / Variables (comma separated) / Constraints / Examples.
3. Click **Generate**. Client → `POST /api/ai/generate-prompt` `{ goal, role?, variables?: string[], constraints?, examples? }` (Bearer auth).
4. Worker: zod parse → `buildCreatePromptMessages(goal, ctx)` → provider → `{ok:true,data:{content}}`.
5. Result panel renders content; **Save** → `POST /api/prompts` with content + context fields.
6. Sidebar/Manage → **Prompt Library** shows saved prompt (search preserved).

### Flow B — Evaluate → Optimize (secondary)
1. From result or journey card → **Evaluator**: paste content → `POST /api/evaluations` → score.
2. **Optimizer**: content → `POST /api/ai/optimize-prompt` (existing) → improved content.

### Flow C — Skills (secondary)
1. Switch engine (Prompt/Skill) in header → Skill journey (Search, Creator, Evaluator, Library, Lab…).
2. Skill Creator: Goal → Generate → `POST /api/ai/generate-skill` `{goal}` (unchanged behavior).

## 5. Data model changes

```ts
// src/worker/schemas.ts — prompt generation only
export const GeneratePromptSchema = z.object({
  goal: BoundedText.min(1),
  role: BoundedText.optional(),
  variables: z.array(BoundedText.min(1)).max(50).optional(), // client splits comma list
  constraints: BoundedText.optional(),
  examples: BoundedText.optional(),
});
```
- Text caps unchanged (`MAX_TEXT`, 20,000). Arrays capped at 50.
- `PromptSchema` (save) already accepts role/variables/constraints/examples — unchanged.
- No D1 migration. No KV changes.

## 6. System design & integration points

```
React (PromptCreator) --api.aiGeneratePrompt(goal, ctx)--> Hono /api/ai/generate-prompt
  -> zod GeneratePromptSchema -> buildCreatePromptMessages(goal, ctx)
  -> provider (OpenAI-compatible) -> {ok:true,data:{content}}
Save: POST /api/prompts -> D1 prompts table
```

- **Client**: `src/client/lib/api.ts` `aiGeneratePrompt(goal, ctx?)` composes body, omitting empty fields. `variables` split on commas, trimmed, empties removed.
- **Worker**: `src/worker/routes/ai.ts` passes `parsed.data` (minus goal) into service; `src/worker/services/ai.ts` `buildCreatePromptMessages` appends deterministic labeled sections: `Role: …`, `Variables: …`, `Constraints: …`, `Examples: …`; goal-only path is byte-identical in shape to today.
- **UI**: `App.tsx` groups `MODULES` metadata by journey; hub CTA sets active module. `PromptCreator` adds collapsible context fieldset (same inputs, same labels) and passes context.

## 7. Requirements → gate mapping

| Req | Description | Verified by |
|---|---|---|
| F-1..F-3 | Optional context in schema/route/service; composition sections; goal-only fallback | Gate 1 unit; Gate 2 integration |
| F-4 | Client api passes context; variables normalized | Gate 1 unit / Gate 3 E2E |
| UX-1/2 | Grouped navigation + single-flow creator; ≤4 clicks to saved prompt | Gate 3 E2E |
| A-1..A-3 | Generation uses all fields; no manual re-entry; empty context omitted | Gate 1/3 |
| NF-3 | `{ok,data,error}` envelope + zod bounds unchanged | Gate 2 |
| NF-5 | E2E green ×3 browsers incl. axe | Gate 3 |
| NF-1/2/4 | CSP, rate limit, perf unchanged | Gate 4 |

## 8. Success criteria (measurable)

1. Request-body test proves context fields reach `POST /api/ai/generate-prompt` (E2E `page.route` capture).
2. Unit test proves composed message contains role/variables/constraints/examples and that goal-only output contains none.
3. Landing page has one primary CTA + journey summary; all modules reachable (E2E navigation test).
4. `npm run lint`, `typecheck`, `build`, `test:unit`, `test:integration` all exit 0.
5. `npm run test:e2e` 0 failures across chromium/firefox/webkit; axe scan no serious/critical violations; no uncaught page errors.
6. Docs (`architecture/api/setup/user-flows`) match implementation; evidence archived in `docs/evidence/`.

## 9. Risks

| Risk | Mitigation |
|---|---|
| E2E copy-coupled to text/selectors | Keep labels/text where feasible; update specs same PR; run 3 browsers |
| Context increases request size/latency | zod caps (≤20k, ≤50 vars); single upstream call; fallback goal-only |
| Navigation refactor breaks deep expectations | Keep module ids and render switch; regroup presentation only |
| Fixture-masked false passes | Assert actual outgoing request bodies; one no-mock smoke check |
