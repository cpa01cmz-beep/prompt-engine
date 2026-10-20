import { test, expect } from "./fixtures";
import { openPromptCreator, openSkillCreator } from "./helpers";

test.describe("prompt engine form flow (Creator)", () => {
  test("generate -> save shows success states and API errors surface", async ({ page }) => {
    const { api, panel } = await openPromptCreator(page);

    const generate = page.waitForResponse(
      (r) => r.url().includes("/api/ai/generate-prompt") && r.status() === 200,
    );
    await page.getByLabel("Goal").fill("Write a launch email");
    await panel.getByRole("button", { name: "Generate" }).click();
    await generate;
    await expect(page.getByLabel("Result")).toHaveValue("Generated prompt content");

    const save = page.waitForResponse(
      (r) => r.url().endsWith("/api/prompts") && r.request().method() === "POST",
    );
    await panel.getByRole("button", { name: "Save" }).click();
    await save;
    await expect(page.getByText("Saved to library.")).toBeVisible();

    // Now the AI endpoint fails: error state wins, stale success is cleared
    api.set("POST /api/ai/generate-prompt", {
      status: 500,
      body: { ok: false, error: "Generation failed" },
    });
    await panel.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Generation failed")).toBeVisible();

    // Save now fails too -> error message from /api/prompts
    api.set("POST /api/prompts", {
      status: 500,
      body: { ok: false, error: "Could not save prompt" },
    });
    await panel.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Could not save prompt")).toBeVisible();
  });

  test("optimizer rewrites the result after a successful generate", async ({ page }) => {
    const { panel } = await openPromptCreator(page);
    await page.getByLabel("Goal").fill("Write a launch email");
    await panel.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByLabel("Result")).toHaveValue("Generated prompt content");

    const optimize = page.waitForResponse(
      (r) => r.url().includes("/api/ai/optimize-prompt") && r.status() === 200,
    );
    await panel.getByRole("button", { name: "Optimize" }).click();
    await optimize;
    await expect(page.getByLabel("Result")).toHaveValue("Optimized prompt content");
  });

  test("context fields reach /api/ai/generate-prompt and empty fields are omitted", async ({ page }) => {
    const bodies: string[] = [];
    await page.route("**/api/ai/generate-prompt", (route) => {
      bodies.push(route.request().postData() ?? "");
      return route.fallback();
    });
    const { panel } = await openPromptCreator(page);

    await panel.getByRole("button", { name: "Add context" }).click();
    await page.getByLabel("Goal").fill("Write a launch email");
    await page.getByLabel("Role").fill("senior marketer");
    await page.getByLabel("Variables (comma separated)").fill(" audience , tone , ,");
    await page.getByLabel("Constraints").fill("Under 200 words");
    await page.getByLabel("Examples").fill("Example launch email");
    await panel.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByLabel("Result")).toHaveValue("Generated prompt content");

    // Context travels with the goal; variables are a trimmed, blank-free string array.
    expect(JSON.parse(bodies[0] ?? "{}")).toEqual({
      goal: "Write a launch email",
      role: "senior marketer",
      variables: ["audience", "tone"],
      constraints: "Under 200 words",
      examples: "Example launch email",
    });

    // Clearing the optional context must restore the goal-only payload (no keys at all).
    await page.getByLabel("Role").fill("");
    await page.getByLabel("Variables (comma separated)").fill("");
    await page.getByLabel("Constraints").fill("");
    await page.getByLabel("Examples").fill("");
    await panel.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByLabel("Result")).toHaveValue("Generated prompt content");
    expect(JSON.parse(bodies[1] ?? "{}")).toEqual({ goal: "Write a launch email" });
  });
});

test.describe("skill engine form flow (Creator)", () => {
  test("generate -> save shows success states and API errors surface", async ({ page }) => {
    const { api, panel } = await openSkillCreator(page);

    const generate = page.waitForResponse(
      (r) => r.url().includes("/api/ai/generate-skill") && r.status() === 200,
    );
    await page.getByLabel("Goal").fill("Summarize long documents");
    await panel.getByRole("button", { name: "Generate" }).click();
    await generate;
    await expect(page.getByLabel("Result")).toHaveValue("Generated skill content");

    const save = page.waitForResponse(
      (r) => r.url().endsWith("/api/skills") && r.request().method() === "POST",
    );
    await panel.getByRole("button", { name: "Save to Library" }).click();
    await save;
    await expect(page.getByText("Saved to library.")).toBeVisible();

    api.set("POST /api/ai/generate-skill", {
      status: 500,
      body: { ok: false, error: "Generation failed" },
    });
    await panel.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Generation failed")).toBeVisible();
  });
});
