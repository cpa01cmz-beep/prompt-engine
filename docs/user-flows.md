# User flows (as implemented)

Derived from `docs/specifications.md` §4. Every element and endpoint named here exists in the code.

## Flow A — Create a prompt (primary journey)

1. Open `/` → the hub shows the journey summary ("Your prompt journey": 1. Create → 2. Evaluate → 3. Optimize → 4. Save) with the single primary CTA button **Start creating a prompt** (`App.tsx`; it selects the Prompt Engine's `creator` module).
2. **PromptCreator** (`src/client/modules/PromptCreator.tsx`), a single ordered screen:
   - **Goal** (required textarea; **Generate** stays disabled until it is non-empty).
   - **Add context** — an `aria-expanded` collapsible (`aria-controls="prompt-context-fields"`) holding the optional **Role**, **Variables (comma separated)** (split on commas, entries trimmed, blanks dropped, capped at 50), **Constraints**, and **Examples** fields.
   - Button **Generate** → `POST /api/ai/generate-prompt` with body `{ goal, role?, variables?: string[], constraints?, examples? }` via `api.aiGeneratePrompt(goal, ctx)`. Empty optional fields (including whitespace-only `Variables`) are absent from the request body. Bearer auth header added by `src/client/lib/api.ts`.
   - Worker: zod `GeneratePromptSchema` → `buildCreatePromptMessages(goal, ctx)` → provider → `{ ok: true, data: { content } }`.
3. The **Result** textarea renders the content (live region). Buttons **Save** / **Evaluate** / **Optimize** act on the result (Evaluate/Optimize remain secondary, disabled until a result exists).
4. Button **Save** → `POST /api/prompts` with content plus the role/variables/constraints/examples context fields → `Saved to library.` success message.
5. Module **Library** (sidebar, "Create your prompt" group) fetches `GET /api/prompts` and shows the saved prompt; the library search field still filters via `GET /api/prompts?q=…`.

## Flow B — Evaluate → Optimize (secondary)

1. From the journey card **Evaluator** (or the Creator's **Evaluate** button): paste content → `POST /api/evaluations` (`api.aiEvaluatePrompt`) → score rendered (score text in the Creator's Evaluation panel).
2. **Optimizer**: content → `POST /api/ai/optimize-prompt` (existing behavior) → improved content replaces the **Result** textarea in the Creator, or is shown in the Optimizer module.

## Flow C — Skills (secondary)

1. Switch engines with the header toggle buttons **Prompt Engine** / **Skills Engine** → Skill journey modules grouped under "Create your skill" (Creator, Evaluator, Optimizer, Library) with Search / Research / Lab under "Advanced tools".
2. Skill **Creator**: **Goal** → button **Generate** → `POST /api/ai/generate-skill` with `{ goal }` (unchanged behavior) → result panel.

## UI structure notes

- `App.tsx` renders the module list as two grouped sections per engine ("Create your prompt" / "Advanced tools", "Create your skill" / "Advanced tools"); module buttons and their ids are unchanged, so all 14 modules remain reachable by click.
- Error path (US-6): AI/save failures surface the `{ ok: false, error }` message via `ErrorText`, success text clears on the next action, no unhandled console errors.
- Regression guarantee (US-3): with only **Goal** filled, the generate request body is exactly `{ goal }`.

## Test coverage mapping

- `tests/e2e/flows.spec.ts` covers Flow A steps 2–4 including the request-body shape test (with context vs. goal-only) and API error surfacing, plus the skill variant of Flow C.
- `tests/e2e/a11y.spec.ts` keeps axe (wcag2a/wcag2aa) scans green across the grouped navigation and module screens.
