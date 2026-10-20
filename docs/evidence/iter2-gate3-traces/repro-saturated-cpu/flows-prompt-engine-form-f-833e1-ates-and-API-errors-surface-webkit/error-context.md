# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flows.spec.ts >> prompt engine form flow (Creator) >> generate -> save shows success states and API errors surface
- Location: tests/e2e/flows.spec.ts:5:3

# Error details

```
TimeoutError: page.waitForResponse: Timeout 15000ms exceeded while waiting for event "response"
```

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('section').getByRole('button', { name: 'Generate' })
    - locator resolved to <button type="button" class="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 px-4 py-2">Generate</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - heading "Prompt & Skills Engine" [level=1] [ref=e10]
      - group "Engines" [ref=e11]:
        - button "Prompt Engine" [pressed] [ref=e12]
        - button "Skills Engine" [ref=e13]
      - generic [ref=e14]:
        - button "Logout" [ref=e15]: Logout (e2e-user)
        - button "Open settings" [ref=e16]: Settings
  - main [ref=e17]:
    - region [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]:
          - heading "Your prompt journey" [level=2] [ref=e21]
          - paragraph [ref=e22]: One flow from a rough goal to a saved prompt. Start with the Creator, then refine.
          - list [ref=e23]:
            - listitem [ref=e24]: 1. Create
            - listitem [ref=e25]: 2. Evaluate
            - listitem [ref=e26]: 3. Optimize
            - listitem [ref=e27]: 4. Save
        - button "Start creating a prompt" [ref=e28]
    - generic [ref=e29]:
      - complementary "Modules" [ref=e30]:
        - navigation "Engine modules" [ref=e31]:
          - group [ref=e32]:
            - paragraph [ref=e33]: Create your prompt
            - list [ref=e34]:
              - listitem [ref=e35]:
                - button "Creator" [ref=e36]
                - generic [ref=e38]: Generate prompts from a goal
              - listitem [ref=e39]:
                - button "Evaluator" [ref=e40]
                - generic [ref=e42]: Score prompt quality
              - listitem [ref=e43]:
                - button "Optimizer" [ref=e44]
                - generic [ref=e46]: Improve prompts
              - listitem [ref=e47]:
                - button "Library" [ref=e48]
                - generic [ref=e50]: Save and manage prompts
          - group [ref=e51]:
            - paragraph [ref=e52]: Advanced tools
            - list [ref=e53]:
              - listitem [ref=e54]:
                - button "Compare" [ref=e55]
                - generic [ref=e57]: Side-by-side comparison
              - listitem [ref=e58]:
                - button "Templates" [ref=e59]
                - generic [ref=e61]: Reusable templates
              - listitem [ref=e62]:
                - button "Research" [ref=e63]
                - generic [ref=e65]: Prompt engineering research
      - generic [ref=e66]:
        - generic [ref=e67]:
          - heading "Creator" [level=2] [ref=e68]
          - paragraph [ref=e69]: "Prompt Engine module: creator"
        - generic [ref=e71]:
          - generic [ref=e72]:
            - generic [ref=e73]: Goal
            - textbox "Goal" [active] [ref=e74]: Write a launch email
          - 'button "Add context (optional: role, variables, constraints, examples)" [ref=e76]'
          - button "Generate" [ref=e81]
          - generic [ref=e82]:
            - generic [ref=e83]:
              - generic [ref=e84]: Result
              - textbox "Result" [ref=e85]
            - generic [ref=e86]:
              - button "Save" [disabled]
              - button "Evaluate" [disabled]
              - button "Optimize" [disabled]
```

# Test source

```ts
  1   | import { test, expect } from "./fixtures";
  2   | import { openPromptCreator, openSkillCreator } from "./helpers";
  3   | 
  4   | test.describe("prompt engine form flow (Creator)", () => {
  5   |   test("generate -> save shows success states and API errors surface", async ({ page }) => {
  6   |     const { api, panel } = await openPromptCreator(page);
  7   | 
  8   |     const generate = page.waitForResponse(
  9   |       (r) => r.url().includes("/api/ai/generate-prompt") && r.status() === 200,
  10  |     );
  11  |     await page.getByLabel("Goal").fill("Write a launch email");
> 12  |     await panel.getByRole("button", { name: "Generate" }).click();
      |                                                           ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  13  |     await generate;
  14  |     await expect(page.getByLabel("Result")).toHaveValue("Generated prompt content");
  15  | 
  16  |     const save = page.waitForResponse(
  17  |       (r) => r.url().endsWith("/api/prompts") && r.request().method() === "POST",
  18  |     );
  19  |     await panel.getByRole("button", { name: "Save" }).click();
  20  |     await save;
  21  |     await expect(page.getByText("Saved to library.")).toBeVisible();
  22  | 
  23  |     // Now the AI endpoint fails: error state wins, stale success is cleared
  24  |     api.set("POST /api/ai/generate-prompt", {
  25  |       status: 500,
  26  |       body: { ok: false, error: "Generation failed" },
  27  |     });
  28  |     await panel.getByRole("button", { name: "Generate" }).click();
  29  |     await expect(page.getByText("Generation failed")).toBeVisible();
  30  | 
  31  |     // Save now fails too -> error message from /api/prompts
  32  |     api.set("POST /api/prompts", {
  33  |       status: 500,
  34  |       body: { ok: false, error: "Could not save prompt" },
  35  |     });
  36  |     await panel.getByRole("button", { name: "Save" }).click();
  37  |     await expect(page.getByText("Could not save prompt")).toBeVisible();
  38  |   });
  39  | 
  40  |   test("optimizer rewrites the result after a successful generate", async ({ page }) => {
  41  |     const { panel } = await openPromptCreator(page);
  42  |     await page.getByLabel("Goal").fill("Write a launch email");
  43  |     await panel.getByRole("button", { name: "Generate" }).click();
  44  |     await expect(page.getByLabel("Result")).toHaveValue("Generated prompt content");
  45  | 
  46  |     const optimize = page.waitForResponse(
  47  |       (r) => r.url().includes("/api/ai/optimize-prompt") && r.status() === 200,
  48  |     );
  49  |     await panel.getByRole("button", { name: "Optimize" }).click();
  50  |     await optimize;
  51  |     await expect(page.getByLabel("Result")).toHaveValue("Optimized prompt content");
  52  |   });
  53  | 
  54  |   test("context fields reach /api/ai/generate-prompt and empty fields are omitted", async ({ page }) => {
  55  |     const bodies: string[] = [];
  56  |     const { panel } = await openPromptCreator(page);
  57  |     // Registered AFTER installApiMocks so it wins (Playwright routes are LIFO);
  58  |     // it observes the body, then falls through to the API mocks.
  59  |     await page.route("**/api/ai/generate-prompt", (route) => {
  60  |       bodies.push(route.request().postData() ?? "");
  61  |       return route.fallback();
  62  |     });
  63  | 
  64  |     await panel.getByRole("button", { name: "Add context" }).click();
  65  |     await page.getByLabel("Goal").fill("Write a launch email");
  66  |     await page.getByLabel("Role").fill("senior marketer");
  67  |     await page.getByLabel("Variables (comma separated)").fill(" audience , tone , ,");
  68  |     await page.getByLabel("Constraints").fill("Under 200 words");
  69  |     await page.getByLabel("Examples").fill("Example launch email");
  70  |     await panel.getByRole("button", { name: "Generate" }).click();
  71  |     await expect(page.getByLabel("Result")).toHaveValue("Generated prompt content");
  72  | 
  73  |     // Context travels with the goal; variables are a trimmed, blank-free string array.
  74  |     expect(JSON.parse(bodies[0] ?? "{}")).toEqual({
  75  |       goal: "Write a launch email",
  76  |       role: "senior marketer",
  77  |       variables: ["audience", "tone"],
  78  |       constraints: "Under 200 words",
  79  |       examples: "Example launch email",
  80  |     });
  81  | 
  82  |     // Clearing the optional context must restore the goal-only payload (no keys at all).
  83  |     await page.getByLabel("Role").fill("");
  84  |     await page.getByLabel("Variables (comma separated)").fill("");
  85  |     await page.getByLabel("Constraints").fill("");
  86  |     await page.getByLabel("Examples").fill("");
  87  |     await panel.getByRole("button", { name: "Generate" }).click();
  88  |     await expect(page.getByLabel("Result")).toHaveValue("Generated prompt content");
  89  |     expect(JSON.parse(bodies[1] ?? "{}")).toEqual({ goal: "Write a launch email" });
  90  |   });
  91  | });
  92  | 
  93  | test.describe("skill engine form flow (Creator)", () => {
  94  |   test("generate -> save shows success states and API errors surface", async ({ page }) => {
  95  |     const { api, panel } = await openSkillCreator(page);
  96  | 
  97  |     const generate = page.waitForResponse(
  98  |       (r) => r.url().includes("/api/ai/generate-skill") && r.status() === 200,
  99  |     );
  100 |     await page.getByLabel("Goal").fill("Summarize long documents");
  101 |     await panel.getByRole("button", { name: "Generate" }).click();
  102 |     await generate;
  103 |     await expect(page.getByLabel("Result")).toHaveValue("Generated skill content");
  104 | 
  105 |     const save = page.waitForResponse(
  106 |       (r) => r.url().endsWith("/api/skills") && r.request().method() === "POST",
  107 |     );
  108 |     await panel.getByRole("button", { name: "Save to Library" }).click();
  109 |     await save;
  110 |     await expect(page.getByText("Saved to library.")).toBeVisible();
  111 | 
  112 |     api.set("POST /api/ai/generate-skill", {
```