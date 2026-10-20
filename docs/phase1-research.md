# Phase 1 — Research & Requirements: "Automate, Simplify, One Clear Journey"

**Status**: Draft for review · **Owner**: PM (Research Analyst subagent) · **Date**: 2026-10-20
**Iteration goal (verbatim)**: "Automate the process, simplify the UI/UX, and create a clear user flow and user story."
**Repo**: `/workspaces/prompt-engine` — React/Vite client (`src/client`) + Hono Worker (`src/worker`), Cloudflare-native.

---

## 0. Verified Current-State (evidence base)

Findings below were verified by reading the code; they anchor every requirement.

| # | Finding | Evidence |
|---|---------|----------|
| V1 | **Context-fields bug confirmed**: `PromptCreator.generate()` calls `api.aiGeneratePrompt(goal)` with ONLY the goal string. Role, Variables, Constraints, Examples inputs are silently ignored at generation time — they persist only at save time via `api.createPrompt({...})`. | `src/client/modules/PromptCreator.tsx` (~L19: `const data = await api.aiGeneratePrompt(goal)`) |
| V2 | The Worker accepts only `{ goal }`: `GeneratePromptSchema = z.object({ goal: BoundedText.min(1) })`; `POST /api/ai/generate-prompt` returns 400 `{ok:false, error:...}` on invalid body; route passes `parsed.data.goal` only to `buildCreatePromptMessages(goal)` (system + single user message). | `src/worker/schemas.ts`; `src/worker/routes/ai.ts`; `src/worker/services/ai.ts` |
| V3 | **Navigation is flat and state-only**: sidebar lists 7 prompt modules (Creator, Evaluator, Optimizer, Compare, Library, Templates, Research) and 7 skill modules (Search, Research, Creator, Optimizer, Evaluator, Library, Lab) as 14 equal-weight buttons; no stage grouping, no primary-row emphasis, no URL/breadcrumb; engine switch resets active module to its first ("creator" / "search"). Default landing = prompt engine / Creator. | `src/client/App.tsx` (`promptModules`, `skillModules`, `renderPromptModule`, `renderSkillModule`) |
| V4 | **No single action hierarchy in Creator**: Generate, Save to Library, Evaluate, and Optimize sit in one same-weight flex row; Save/Evaluate/Optimize are disabled until a result exists, but the user is never told what to do next; result is editable in-place. | `PromptCreator.tsx` button row |
| V5 | **Skills lag in context AND metadata**: `SkillCreator` has a Goal field only; `aiGenerateSkill(goal)`; save hardcodes `description: "Generated skill"` instead of using goal-derived text. | `src/client/modules/SkillCreator.tsx` |
| V6 | Design system exists and is reusable: Card, Button (variant/size/loading), Alert(tone), ErrorText, SuccessText, Spinner, Loading, Skeleton, SkeletonText, ResultPanel, Chip, Stat, EmptyState, Input(label/hint/required, `useId` wiring), Textarea, Field(render-prop). Inputs are already accessible — no a11y rebuild needed, only composition. | `src/client/components/ui.tsx` (398 lines) |
| V7 | Typed fetch wrapper with `{ok,data,error}` envelope, Bearer token from localStorage (`getAccessToken`), ~35 endpoints; `aiGeneratePrompt(goal)` and `aiGenerateSkill(goal)` are the two generation calls that must grow context params. | `src/client/lib/api.ts` |
| V8 | E2E is Playwright with 3 browser projects (chromium/firefox/webkit), baseURL `localhost:5177`, webServer runs `npm run dev`. Tests are selector/text-coupled: `getByLabel("Goal")`, `getByLabel("Result")`, button names "Generate", "Save to Library", "Optimize", aside buttons by module title, heading "Prompt & Skills Engine". `a11y.spec.ts` runs axe (WCAG A/AA) on home + every module screen; `modules.spec.ts` parameterizes over all 14 module titles. | `playwright.config.ts`, `tests/e2e/{home,modules,flows,search-library,a11y}.spec.ts`, `tests/e2e/helpers.ts` |
| V9 | CI gates: lint, typecheck, build, unit (~38 cases across 7 files incl. schemas/ai/schema-hardening), integration, e2e. | CI config + `tests/unit/` |
| V10 | Security invariant preserved: `rateLimitMiddleware` on all routes; `security.ts` sets CSP with `connectSrc: ["'self'"]`; secrets never leave trusted envs; zod bounds: text ≤20,000 chars, short text ≤300, arrays ≤50 items, JSON ≤32 KB. | `src/worker/middleware/*`, `src/worker/schemas.ts` |
| V11 | Prompt domain retained on save: `Prompt` type carries `role?, variables?: string[], constraints?, examples?, tags?`; shared types unchanged by this work. | `src/shared/types.ts` |

**Implication**: the two highest-impact fixes are (1) one generate action that actually *uses* everything the user typed, and (2) converting 14 equal buttons into a guided journey without deleting any module. Everything else in this iteration is composition on top of existing components and endpoints.

---

## 1. SCOPE

### In scope
1. **Fix the context-fields gap**: extend `GeneratePromptSchema` / `GenerateSkillSchema` with *optional* role/variables/constraints/examples (and skill description/tools/examples bounds); extend `buildCreatePromptMessages` / `buildCreateSkillMessages` to include all provided context in the LLM user message; update `api.aiGeneratePrompt` / `api.aiGenerateSkill` typed signatures to accept a context object.
2. **Prompt Creator flow automation**: one primary Generate action; variables auto-parsed (trim, comma-split, dedupe) client-side before send; post-generation defaults preselected/prefilled (auto-derived title for save, "Save & evaluate" affordance, secondary actions enabled with clear labels); no second API call introduced beyond what exists (no new rate-limit pressure).
3. **Navigation simplification**: group the 14 modules under 3 stage headings (Create → Improve → Manage) on the prompt side and equivalent on the skill side; mark the primary journey (Creator → Evaluator → Optimizer → Library) visually; all modules remain reachable through the same interaction pattern.
4. **Journey continuity**: after generation, in-module next-step guidance (e.g., result panel action ordering + one-click transitions into Evaluator/Optimizer/Library carrying the current result via existing state or props — no router required).
5. **Skill parity**: SkillCreator gains optional Description/Tools/Examples inputs using the same context-object pattern; save derives description from goal/result instead of the hardcoded string.
6. **Test coordination**: any visible label/selector change lands in the same PR with the corresponding `tests/e2e/**` updates so all 3 browser projects stay green.

### Out of scope (explicit non-goals)
- **No capability removal.** All 14 modules stay reachable; no module is deleted, hidden behind a flag only, or merged away.
- **No design-system rewrite.** `ui.tsx` component APIs stay as-is; new screens compose existing components (adding a new convenience component is allowed; changing existing prop shapes is not).
- **No new Worker endpoints, no envelope change**: `{ok,data,error}` and zod validation stay; rate limiting (`rateLimitMiddleware`) and CSP (`connectSrc: ["'self'"]`, `security.ts`) untouched; no new outbound origins.
- **No router/URL state, no persistence layer changes, no DB migration** — navigation state remains as today (refactor to URL later).
- **No new AI features** (no chat in Creator, no auto-improvement loops) — automation = using provided context + fewer steps, not new LLM calls.
- **No theming/dark mode/mobile-app work**, no auth flow changes, no settings modal changes.
- **No removal of advanced modules** (Compare, Templates, Research, SkillLab, SkillSearch) — they keep their positions in the new grouping.

### Hard constraints (from AGENTS.md + verified invariants)
- TypeScript strict mode; functions small and tested.
- Keep quality-gate set green: `lint`, `typecheck`, `build`, `test:unit`, `test:integration`, `test:e2e` (3 browsers).
- Breaking UI text/selector changes require coordinated E2E updates **in the same PR**.
- Store quality-gate evidence under `docs/evidence/`.

---

## 2. USER STORIES

### US-1 — First glance tells the new user what to do
**As a** first-time logged-in user, **I want** the Creator screen to show one obvious primary action with a plain-language label, **so that** I know my first move within one screen without reading any docs.
**Acceptance criteria (Given/When/Then)**:
- **Given** I land on the app with no navigation history, **when** the Creator view renders, **then** exactly one button is visually dominant (primary variant), it says "Generate prompt", and a hint line under the Goal field explains what to type.
- **Given** the Goal field is empty, **when** I view the screen, **then** Generate is disabled *and* the disabled reason is perceivable (helper text, not a mystery dead button).
- **Given** I am on any of the 14 module screens, **when** the screen renders, **then** no module requires more than one screen of scrolling to reach its first actionable input (axe-clean layout).
- **Given** I switch engine from Prompt to Skills, **when** the view resets to that engine's first module, **then** the same "one primary action" rule holds for Skill Search (its screen-equivalent default).

### US-2 — Generation uses everything I typed
**As a** prompt author who filled in Role, Variables, Constraints, and Examples, **I want** a single Generate action that sends and uses all my inputs, **so that** the generated prompt reflects my full context on the first try.
**Acceptance criteria**:
- **Given** Goal + any non-empty subset of Role/Variables/Constraints/Examples, **when** I click Generate, **then** the outgoing `POST /api/ai/generate-prompt` request body contains `goal` plus every non-empty field (`variables` already parsed into the trimmed, deduped `string[]`), verified by request-body interception in E2E.
- **Given** Goal is non-empty and all context fields are empty, **when** I Generate, **then** the behavior/API contract is byte-compatible with today (only `goal` sent) — no regression.
- **Given** any generated request, **when** Goal alone is empty, **then** the Worker still responds 400 with the zod error (existing contract; goal remains required).
- **Given** context fields whose total serialized size exceeds the zod bounds (text ≤20,000; array ≤50 items), **when** I Generate, **then** the client surfaces the validation error message without crashing, and the Worker rejects at the same bounds.
- **Given** the generated result, **when** I inspect it, **then** it demonstrably incorporates provided context (unit test asserts `buildCreatePromptMessages` composes Role/Variables/Constraints/Examples into the user message; e.g., a Role string appears in the composed message).

### US-3 — Fewer manual steps from idea to saved prompt
**As a** prompt author, **I want** sensible defaults applied automatically after generation (derived title, pre-selected save action, next-step guidance), **so that** saving takes the minimum number of interactions.
**Acceptance criteria**:
- **Given** a successful generation, **when** the result appears, **then** the save title pre-fills from Goal (≤80 chars, existing rule) — the Title derivation never requires user typing.
- **Given** a successful generation, **when** the result appears, **then** "Save to Library" becomes the secondary-highlighted affordance directly beneath the result, and Evaluate/Optimize are clearly labeled as follow-ups (not equal-weight competitors).
- **Given** a successful generation, **when** I save, **then** the save `POST /api/prompts` body is unchanged in shape (title/content/role/variables/constraints/examples) and the success alert "Saved to library." still renders (existing E2E expectations preserved or updated in same PR).
- **Given** I have generated and saved once, **when** I count interactions from first paint, **then** a filled-in creation requires ≤ **3 clicks/interactions** (Generate, Save, plus at most one correction) — measured as a matter-of-course path in E2E.
- **Given** variable text like " topic , topic , tone ", **when** I Generate or Save, **then** variables are deduped/trimmed consistently in both paths (single parser reused → identical data saved and sent).

### US-4 — A clear Create → Evaluate → Optimize → Library journey
**As a** returning user, **I want** the sidebar to organize modules into a guided stage order (Create, Improve, Manage) with the primary journey visually distinguishable, **so that** I don't re-scan 14 equal buttons to find the next step.
**Acceptance criteria**:
- **Given** the prompt engine view, **when** the sidebar renders, **then** modules are grouped under three stage headings: **Create** (Creator, Templates), **Improve** (Evaluator, Optimizer, Compare, Research), **Manage** (Library) — every module appears in exactly one group.
- **Given** the skill engine view, **when** the sidebar renders, **then** an equivalent grouping exists (Discover: Search, Research · Improve: ... · Manage: Library, Lab) with all 7 modules reachable.
- **Given** any module, **when** I use keyboard navigation (Tab/arrow within the nav role), **then** aria-current and engine toggle (`aria-pressed`) semantics are preserved (axe must pass on all module screens).
- **Given** I click through the primary journey Creator → Evaluator → Optimizer → Library, **when** I move manually via the sidebar, **then** each step is reachable in one click and results still persist in-state within a module (no result loss vs. today).
- **Given** deep stationary checks in `modules.spec.ts`, **when** tests iterate the 14 module titles, **then** all titles still render content (test updated only if titles are renamed, in the same PR, with names kept recognizable, e.g., "Creator" stays "Creator").

### US-5 — Skill creation parity and effortless library access
**As a** skills-engine user, **I want** skill creation to mirror the prompt journey (context fields in one generate, derived metadata on save) and libraries to be effortless to reach, **so that** both engines feel like one product.
**Acceptance criteria**:
- **Given** SkillCreator, **when** I generate, **then** the request may include optional description/tools/examples the user typed (schema extended, pattern identical to US-2), and omission keeps today's contract.
- **Given** a generated skill, **when** I save, **then** the saved skill's `description` is derived (goal/result-based, non-hardcoded), while `name` keeps the ≤80-char goal-derived rule.
- **Given** I want a saved artifact, **when** I open Library from the Manage group, **then** PromptLibrary/SkillLibrary load with search-as-typed (`getPrompts(q)`) unchanged, and errors from load/save fetches surface before user actions (existing `search-library.spec.ts` expectations preserved).
- **Given** either engine, **when** any step fails (AI 4xx/5xx, save failure), **then** the error is shown via the existing Alert/ErrorText pattern, success text is cleared on the next action (parity with today's flows.spec behavior).

---

## 3. USER FLOWS

### Flow A (Primary): Create a prompt from full context (start → saved)
| Step | User action | UI element (existing component) | API call |
|---|---|---|---|
| A1 | Log in / land | App shell → header "Prompt & Skills Engine", engine toggle (aria-pressed) defaults to Prompt | — (no call; token from localStorage; `getMe()` only when token exists, with silent logout on 401) |
| A2 | Land in Creator | Sidebar → Create group → **Creator** (default module; `aria-current` set) | — |
| A3 | Describe the goal | `Textarea label="Goal"` (required; hint under field) | — |
| A4 | (Optional) Add context | `Input label="Role"`, `Input label="Variables"`, `Textarea label="Constraints"`, `Textarea label="Examples"` | — |
| A5 | Click **Generate prompt** (primary; enabled iff Goal non-empty) | `Button variant="primary"` with `aria-busy` loading state | `POST /api/ai/generate-prompt` body `{ goal, role?, variables: string[] (trimmed, deduped, ≤50), constraints?, examples? }` → Worker zod → `buildCreatePromptMessages(goal, context)` → LLM chat completion |
| A6 | Review / tweak result | Result textarea (`aria-live="polite"` region) | — |
| A7 | Click **Save to Library** (secondary-highlighted) | `Button` (title pre-derived from Goal, editable) | `POST /api/prompts` (createPrompt) |
| A8 | Follow next-step guidance | In-module next-step row: **Evaluate** / **Optimize** labeled as follow-ups | Evaluate: `POST /api/ai/evaluate-prompt`; Optimize: `POST /api/ai/optimize-prompt` |
| A9 | (Optional) Continue journey | Sidebar → Improve → Evaluator/Optimizer, or Manage → Library | Evaluator uses `aiEvaluatePrompt`, Optimizer `aiOptimizePrompt`, Library loads `getPrompts(q)` |

### Flow B (Secondary): Create a skill with parity
| Step | User action | UI element | API call |
|---|---|---|---|
| B1 | Switch engine | Header → "Skills Engine" toggle (`aria-pressed`) — active module resets to that engine's first | — |
| B2 | (Optional) Discover | Sidebar → Skill Discover group → Search: query `Input` | `POST /api/ai/search-skills` / `GET /api/search/web?q=` per existing module wiring |
| B3 | Open Skill Creator | Sidebar → Skill Create group → Creator | — |
| B4 | Goal + optional context | `Textarea label="Goal"` + optional Description/Tools/Examples inputs | — |
| B5 | Generate | Primary `Button` | `POST /api/ai/generate-skill` body `{ goal, description?, tools?: string[], examples?: string[] }` → zod → `buildCreateSkillMessages(goal, context)` → LLM; worker may attach parsed JSON skill (existing parse-fallback-null contract) |
| B6 | Save | Secondary-highlighted `Button` (name/description derived from goal+result; no hardcoded "Generated skill") | `POST /api/skills` (createSkill) |
| B7 | Evaluate/Optimize follow-ups | Follow-up row as in Flow A | `POST /api/ai/evaluate-skill`, `POST /api/ai/optimize-skill` |

### Flow C (Tertiary): Library access & re-evaluation
| Step | User action | UI element | API call |
|---|---|---|---|
| C1 | Open Library | Sidebar → Manage → **Library** (prompt or skill engine respectively) | `GET /api/prompts?q=` / `GET /api/skills?q=` |
| C2 | Search | Library search `Input` (query-as-typed) | Same endpoints with query param |
| C3 | Open/edit a prompt | Library list item → result/edit panel | `PUT /api/prompts/:id` on edit |
| C4 | Re-evaluate saved content | Evaluate action from library/module | `POST /api/ai/evaluate-prompt` (returns content + optional structured evaluation; zod-parsed, fallback null) |
| C5 | Delete | Delete button (danger variant) | `DELETE /api/prompts/:id` |
| C6 | Errors surface | Alert tone="error" via ErrorText; prior success text cleared | All failures surface `{ok:false,error}` message text |

---

## 4. REQUIREMENTS TABLE

**Priority legend**: P0 = iteration-blocking · P1 = committed · P2 = stretch.

### Functional (F-xx)
| ID | Requirement | Acceptance test | Priority | Story |
|----|-------------|-----------------|----------|-------|
| F-1 | `api.aiGeneratePrompt` accepts `GeneratePromptRequest = { goal: string; role?: string; variables?: string[]; constraints?: string; examples?: string?[] }`; empty strings/arrays are omitted from the body (compat with today). | Unit test on body serialization; E2E request-body interception asserts fields present when filled. | P0 | US-2 |
| F-2 | `GeneratePromptSchema` gains optional `role` (BoundedShortText ≤300), `variables` (BoundedStrings ≤50 items), `constraints` (BoundedText ≤20k), `examples` (BoundedText ≤20k); `goal` stays required first-bound. | `tests/unit/schemas.test.ts` cases: valid full body; 400 for missing goal; rejection of oversized field. | P0 | US-2 |
| F-3 | Worker route passes parsed context into service: `buildCreatePromptMessages(goal, ctx)` composes Role/Variables/Constraints/Examples into the user message; empty context produces the exact today message. | Unit: composed message contains non-empty fields in deterministic order; parity test for empty context. | P0 | US-2 |
| F-4 | `GenerateSkillSchema` + `buildCreateSkillMessages` mirror F-2/F-3 with `description?`, `tools?: string[]`, `examples?: string[]`. | Unit mirrors F-2/F-3. | P1 | US-5 |
| F-5 | Variables parsing helper (trim, comma-split, dedupe, filter-empty) is a single shared client function used by both send and save paths. | Unit test: `" a, a ,b, ,, c "` → `["a","b","c"]`; parity between generate body and createPrompt body. | P0 | US-3 |
| F-6 | SkillCreator save derives `description` from goal (≤300) instead of hardcoded "Generated skill"; `name` derivation rule (goal ≤80) unchanged. | Unit + E2E assertion on POST /api/skills body. | P1 | US-5 |
| F-7 | Navigation state model stays client-internal (no router); grouping is data-driven side of App.tsx: `stage: "create"\|"improve"\|"manage"` on each module entry; default module mapping unchanged (prompt→creator, skill→search... preserved semantics). | Unit render test on grouping order; E2E modules.spec still enumerates all 14 titles. | P0 | US-1, US-4 |

### UX requirements (UX-xx)
| ID | Requirement | Acceptance test | Priority | Story |
|----|-------------|-----------------|----------|-------|
| UX-1 | Creator renders exactly one primary-variant button ("Generate prompt"); Save is secondary variant; Evaluate/Optimize are tertiary/ghost with cleaner labels; visible until actions require a result (existing disabled logic kept). | Snapshot/role assertions in E2E; axe clean. | P0 | US-1, US-3 |
| UX-2 | Sidebar shows stage headings (Create / Improve / Manage) each with `aria-label`d group; primary journey items keep their existing accessible names ("Creator", "Evaluator", "Optimizer", "Library"). | E2E aside structure test; a11y.spec passes across 3 browsers. | P0 | US-4 |
| UX-3 | Goal field shows helper hint; disabled Generate carries an explanatory hint line (e.g., "Describe what the prompt should do first."). | E2E: hint visible when Goal empty. | P1 | US-1 |
| UX-4 | After generation: title pre-derived for save appears in the save affordance; follow-up row order = Save → Evaluate → Optimize. | E2E flow test A7-style. | P1 | US-3 |
| UX-5 | All existing success/error message texts ("Saved to library.", API error passthrough) remain intact wherever feasible; any renamed/changer text ships with same-PR E2E edits. | flows.spec green in 3 browsers. | P0 | US-2/3 |
| UX-6 | Post-generation next-step guidance: one line under result ("Now: save it, or check quality.") is logically implied by the ordered action row and result panel labels rather than a new banner — keep the panel minimal. | Manual + axe contrast check (a11y.spec). | P2 | US-4 |
| UX-7 | Keyboard parity: primary action is the first button in DOM order of the action row; groups orderable via arrow keys; focus states visible (FOCUS_RING tokens preserved). | a11y.spec (WCAG A/AA) + keyboard walkthrough test. | P1 | US-1, US-4 |

### Automation requirements (A-xx)
| ID | Requirement | Acceptance test | Priority | Story |
|----|-------------|-----------------|----------|-------|
| A-1 | Generate uses every provided context field in the same request (no implicit second call). | E2E body interception = single request containing all fields. | P0 | US-2 |
| A-2 | Save title/description/name derivation is automatic from goal (existing ≤80 char) with 0 required user typing. | E2E: click-Generate → Save works with only typing Goal. | P0 | US-3 |
| A-3 | Variables dedupe/trim applied automatically both at send and save (one parser). | Unit F-5. | P0 | US-3 |
| A-4 | Sensible defaults preselected: engine default = prompt/Creator; skill first module default preserved ("Search"/discovery-first for skills as today). | E2E home.spec "loads and shows the default prompt engine view" + switch tests kept green. | P0 | US-1, US-4 |
| A-5 | After successful generation, secondary actions auto-enable (existing logic) AND next-step ordering is fixed so no exploration is needed to find Save. | E2E: ordered button assertions. | P1 | US-3 |
| A-6 | SkillCreator context fields above optional; Default description auto-derived at save. | Unit F-6. | P1 | US-5 |

### Non-functional (NF-xx)
| ID | Requirement | Acceptance test | Priority | Story |
|----|-------------|-----------------|----------|-------|
| NF-1 | TypeScript strict; no `any`; new helpers small + unit-tested. | `npm run typecheck` + `npm run lint` clean. | P0 | all |
| NF-2 | `ui.tsx` component prop APIs unchanged (may add new components, never change existing shapes). | Typecheck against all 16 modules' usages; review gate. | P0 | all |
| NF-3 | `{ok,data,error}` envelope everything; zod-only validation; Worker 400/404/500 behavior unchanged except new optional-field acceptance. | Unit hardening tests; integration tests green. | P0 | US-2 |
| NF-4 | No new outbound origins; CSP (`connectSrc: ["'self'"]`) and `rateLimitMiddleware` unchanged — generation remains a single rate-limited request per action. | Unit rateLimit.test green; security review note in docs/evidence. | P0 | all |
| NF-5 | E2E green on chromium/firefox/webkit for home, modules, flows, search-library, a11y (axe WCAG A/AA per screen) — same selector names where feasible; any rename has a same-PR test edit. | `npm run test:e2e` 0 failures ×3 projects. | P0 | all |
| NF-6 | No dataset/regression risk: LLM output contract unchanged (content-only for prompt generate; JSON-parse fallback null persists); AI temperature settings unchanged. | Unit ai tests unchanged-passing except extended build*Messages tests. | P1 | US-2 |

**Requirement count: 7 F + 7 UX + 6 A + 6 NF = 26.**

---

## 5. SUCCESS CRITERIA (measurable)

| # | Metric | Baseline (verified) | Target | How measured |
|---|--------|---------------------|--------|--------------|
| S1 | Context-fields bug eliminated: generate request carries every filled field | Fields ignored at send (V1) | 100% of filled fields present in `POST /api/ai/generate-prompt` body; dedicated unit tests for `buildCreatePromptMessages(goal, ctx)` | E2E request interception + unit suite (new cases) |
| S2 | Clicks from open app (fresh load, prompt engine) to a saved prompt with context-filled form | ≥3 clicks + manual title/variable handling, no auto-derive guarantees | ≤ **3 clicks/interactions** (type Goal → Generate → Save) | Scripted E2E counter in one authored test run |
| S3 | Manual steps in prompt creation | Generate; manually ensure title; Save; manually arrange evaluate/optimize | Title auto-derived (0 typing), follow-up order fixed; evaluation of next step one click away | E2E flow A render assertions |
| S4 | Navigation clarity | 14 same-weight buttons | 3 stage groups; primary journey items visually primary; every module reachable | E2E structure test + manual walkthrough across all 14 titles |
| S5 | Quality gates | CI passes today | lint 0, typecheck 0, build ok, unit (~38+new) green, integration green, e2e green ×3 browsers | CI run evidence in `docs/evidence/` |
| S6 | Accessibility | axe WCAG A/AA clean per screen (a11y.spec) | Stays clean after nav/creator changes on all module screens ×3 browsers | a11y.spec runs |
| S7 | API compatibility | Only `{goal}` valid | Old clients (goal-only requests) still succeed; new optional fields accepted; goal-missing → 400 | schemas.test.ts + integration |
| S8 | Skill parity | Skills lack context fields/hardcoded description | SkillCreator context accepted at generate; derived description at save | Unit F-4/F-6 + E2E body assertions |
| S9 | Rate-limit/CSP invariants | middleware unchanged | No new calls per flow; security middleware diff = 0 | review + docs/evidence note |

---

## 6. RISKS & MITIGATIONS

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | E2E brittleness from any label/order change (tests bind to "Goal", "Result", button names, aside buttons). | High | Med-High | Keep existing accessible names wherever possible ("Creator", "Generate", "Save to Library"); every rename gets a same-PR test edit; run all 3 browser projects locally before pushing. |
| R2 | Larger request bodies with examples/constraints increase LLM latency/failure surface or quality regression. | Med | Med | Bounds inherit zod caps (≤20k text, ≤50 vars); deterministic message composition unit-tested; fallback to goal-only composition if context is empty; no new outbound calls. |
| R3 | Grouped navigation hides "advanced" modules (Compare/Templates/Research/Lab) → perceived capability loss. | Med | Med | All modules stay listed under a stage heading, not collapsed; visibility unchanged (no overflow-collapse on desktop); manual check across all 14 screens. |
| R4 | Schema change destabilizes integration tests that assert exact 400 responses. | Med | Med | Keep `goal` required; only add optional fields; run integration before e2e; update fixtures in same PR. |
| R5 | Rendersmith: pushing context through one generate action could slow the "hero path" (single request with 5 fields). | Low | Low | One request was always the goal (vs. multi-call automation); rate limiting untouched. |
| R6 | A11y regression from new groupings (headings inside `nav`, group focus order). | Med | High (a11y.spec blocks CI) | Use `nav` with `aria-label`ed subgroups; axe locally per screen; FOCUS_RING tokens reused; keyboard test UX-7. |
| R7 | Scope creep: proposals grow into routing/URL/dark-mode/multi-step wizard redesigns. | Med | Med | Out-of-scope list above is binding; PR scope reviewed against Section 1 only; any addition gets a formal deferral entry. |
| R8 | Playwright trust: fixtures mask 200 when tests run against real Worker (fixture `page.route` masking = tests false-pass). | Med | Med | Keep fixture masking for error-path tests only; request-body assertions use actual outgoing bodies; run a no-mock smoke pass for Flow A once per iteration. |
| R9 | Engine-switch reset surprise (active resets to first module on switch) interacts badly with new grouping defaults. | Low-Med | Low | Preserve existing reset behavior; document it in flow; add explicit E2E assertion so it cannot drift. |

---

## 7. ASSUMPTIONS & RESOLUTIONS

| ID | Assumption | If wrong, resolution |
|----|------------|----------------------|
| AS-1 | No DB schema changes needed (context on generate is transient, prompt/skill models already carry metadata). | Not needed: `Prompt`/`Skill` types already store role/variables/constraints/examples (verified in `src/shared/types.ts`). |
| AS-2 | LLM provider accepts larger user messages within `max_tokens: 1200` output; input truncation/overflow handled by zod bounds client and server. | If giant context degrades output quality, cap examples at smaller bound (e.g., 2k chars) and document operator-visible hint. |
| AS-3 | E2E fixtures (`page.route` masking) can be updated within the same iteration without breaking other suites. | Coordinate with the implementer via this doc; update `tests/e2e/fixtures.ts` alongside; run full 3-project matrix. |
| AS-4 | Navigation remains local state — no need for routers/cookies/workers KV in this iteration. | URL deep-linking is explicitly deferred; if product demands it, schedule as separate Next-quarter item with its own assessment. |
| AS-5 | Skill parity uses the same zod pattern family as prompts (BoundedText family), so no new validation machinery. | If skills need richer structure, that jumps to `runSkill`-like JSON schemas — out of scope this iteration. |
| AS-6 | Role/Variables/Constraints/Examples strings from users are plain text, never executable context injection risk beyond LLM prompt itself (Worker strips/normalizes nothing else today). | Workers trust boundary: bounded text only; if policy requires, add server-side normalization — separate topic, tracked in risk register. |
| AS-7 | Default landing (prompt engine / Creator) is the desired primary journey start. | Verified in code (App.tsx default state); if product wants Library-first, change one constant + E2E home.spec — trivial. |
| AS-8 | CI runner can run all e2e 3-browser projects within time budgets. | Verified from playwright.config trace/screenshot settings; if slow, retry=2 keeps stability; parallelize in CI as needed. |

---

## 8. Definition of done for Phase 1 → Phase 2 (handoff)
- This document reviewed and approved (scope + stories + requirements).
- RICE-lite: highest value / lowest effort pairings are **F-1..F-3 (P0)** + **UX-1/UX-2 (P0)**; skill parity (F-4, F-6, A-6) is P1-next.
- Implementation plan derived from this doc; requirement IDs become PRD acceptance-criteria cross-references.
- Evidence of green gates archived to `docs/evidence/` per repo convention.
