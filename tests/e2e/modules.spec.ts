import { test, expect } from "@playwright/test";
import { installApiMocks } from "./helpers";

const PROMPT_MODULES = ["Creator", "Evaluator", "Optimizer", "Compare", "Library", "Templates", "Research"];

const SKILL_MODULES = ["Search", "Research", "Creator", "Optimizer", "Evaluator", "Library", "Lab"];

test.describe("all modules render", () => {
  test.beforeEach(async ({ page }) => {
    // Modules like Library/Templates/Lab fetch on mount; keep the API mocked
    await installApiMocks(page);
  });

  for (const title of PROMPT_MODULES) {
    test(`prompt engine: ${title} renders content`, async ({ page }) => {
      await page.goto("/");

      await page.locator("aside").getByRole("button", { name: title }).click();
      await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
      await expect(page.getByText(`Prompt Engine module: ${title.toLowerCase()}`)).toBeVisible();

      const section = page.locator("section");
      await expect(section).toBeVisible();
      // Every module owns at least one interactive control
      await expect(section.locator("textarea, input, button, select").first()).toBeVisible();
    });
  }

  for (const title of SKILL_MODULES) {
    test(`skill engine: ${title} renders content`, async ({ page }) => {
      await page.goto("/");

      await page.getByRole("button", { name: "Skills Engine" }).click();
      await page.locator("aside").getByRole("button", { name: title }).click();
      await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
      await expect(page.getByText(`Skills Engine module: ${title.toLowerCase()}`)).toBeVisible();

      const section = page.locator("section");
      await expect(section).toBeVisible();
      await expect(section.locator("textarea, input, button, select").first()).toBeVisible();
    });
  }
});
