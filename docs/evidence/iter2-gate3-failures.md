# Gate 3 — failure triage (initial run)

**Date:** 2026-10-20
**Suite:** `npm run test:e2e` (Playwright, projects chromium/firefox/webkit)
**Initial result:** exit 1 — **3 failed, 102 passed (9.1m)**
**Raw log:** the first run's stdout was captured to `docs/evidence/iter2-gate3-e2e.log`
and later overwritten by the green re-run; the failure text is reproduced verbatim
below and the decoded trace is preserved at
`docs/evidence/iter2-gate3-traces/chromium-context-fields/`.

## Failing test (same test in all 3 projects)

`tests/e2e/flows.spec.ts:54` → *prompt engine form flow (Creator) › context fields
reach /api/ai/generate-prompt and empty fields are omitted*

| Project | Result |
|---|---|
| chromium | FAIL |
| firefox | FAIL |
| webkit | FAIL |

## Verbatim assertion output (chromium)

```
  1) [chromium] › tests/e2e/flows.spec.ts:54:3 › prompt engine form flow (Creator) › context fields reach /api/ai/generate-prompt and empty fields are omitted

    Error: expect(received).toEqual(expected) // deep equality

    - Expected  - 10
    + Received  +  1

    - Object {
    -   "constraints": "Under 200 words",
    -   "examples": "Example launch email",
    -   "goal": "Write a launch email",
    -   "role": "senior marketer",
    -   "variables": Array [
    -     "audience",
    -     "tone",
    -   ],
    - }
    + Object {}

      70 |
      71 |     // Context travels with the goal; variables are a trimmed, blank-free string array.
    > 72 |     expect(JSON.parse(bodies[0] ?? "{}")).toEqual({
         |                                           ^
      73 |       goal: "Write a launch email",
      74 |       role: "senior marketer",
      75 |       variables: ["audience", "tone"],
        at /workspaces/prompt-engine/tests/e2e/flows.spec.ts:72:43
```

firefox and webkit reported the identical assertion with their own
`test-results/...-firefox/` and `...-webkit/` artifact directories.

## Root cause — test artifact, NOT a product defect

`bodies[0]` was `undefined`, so `JSON.parse("{}")` produced `{}`. The interceptor
that fills `bodies` never ran:

1. `installApiMocks()` registers a catch-all `page.route("**/api/**", …)`.
2. The spec registered `page.route("**/api/ai/generate-prompt", …)` **before**
   calling `openPromptCreator()` (which calls `installApiMocks`).
3. Playwright resolves routes **LIFO** — the last registered matching route wins.
   The catch-all therefore handled `POST /api/ai/generate-prompt`, and the narrow
   observing route (with `route.fallback()`) was never invoked.
4. `bodies` stayed empty → assertion failed. The app itself behaved correctly.

## Proof the product behavior is correct

Decoded from the retained trace (`docs/evidence/iter2-gate3-traces/chromium-context-fields/`,
`resources/b961…json`), the request the app actually sent was:

```json
{"goal":"Write a launch email","role":"senior marketer","variables":["audience","tone"],"constraints":"Under 200 words","examples":"Example launch email"}
```

and the response was `{"ok":true,"data":{"content":"Generated prompt content"}}`.
That body matches the test's expectation exactly: variables trimmed from
`" audience , tone , ,"` to `["audience","tone"]`, and no empty keys. The UI also
rendered `Generated prompt content` in the Result field before the assertion ran.

## Fix applied (test file only — no product code touched)

`tests/e2e/flows.spec.ts`: register the observing route **after**
`openPromptCreator(page)` so it wins the LIFO order and forwards with
`route.fallback()` to the mocks.

```ts
const bodies: string[] = [];
const { panel } = await openPromptCreator(page);
// Registered AFTER installApiMocks so it wins (Playwright routes are LIFO);
// it observes the body, then falls through to the API mocks.
await page.route("**/api/ai/generate-prompt", (route) => {
  bodies.push(route.request().postData() ?? "");
  return route.fallback();
});
```

Scope: this is a *harness ordering* fix, not a weakened assertion. Both
assertions (context payload, and the goal-only payload after clearing) still run
unchanged.

## Reproduction

```bash
git stash                       # or check out the pre-fix spec
npx playwright test tests/e2e/flows.spec.ts:54 --project=chromium --reporter=list
# => 1 failed  (Received: Object {})
npx playwright test tests/e2e/flows.spec.ts:54 --project=chromium --reporter=list
# after fix => 1 passed
```

Trace forensics:

```bash
npx playwright show-trace docs/evidence/iter2-gate3-traces/chromium-context-fields/
# or, from a fresh failure:
npx playwright show-trace test-results/<dir>/trace.zip
```

## Follow-up (non-blocking, test-infra hygiene)

`installApiMocks`' `**/api/**` catch-all is broad enough to shadow per-test
observers registered earlier. Consider exposing `installApiMocks` as a fixture
that installs the catch-all first (at worker/test start) so specs can always
layer observers on top without depending on registration order. Filing as
test-infra cleanup, not a Gate 3 blocker.
