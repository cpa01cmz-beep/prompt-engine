import { test, expect } from "@playwright/test";
import { installApiMocks } from "./helpers";
const PROMPT_MODULES = [
  { title: "Creator", id: "creator" },
  { title: "Evaluator", id: "evaluator" },
  { title: "Optimizer", id: "optimizer" },
  { title: "Compare", id: "compare" },
  { title: "Library", id: "library" },
  { title: "Templates", id: "template" },
  { title: "Research", id: "research" },
];
const SKILL_MODULES = [
  { title: "Search", id: "search" },
  { title: "Research", id: "research" },
  { title: "Creator", id: "creator" },
  { title: "Optimizer", id: "optimizer" },
  { title: "Evaluator", id: "evaluator" },
  { title: "Library", id: "library" },
  { title: "Lab", id: "lab" },
];
test.describe("all modules render", () => {
  test.beforeEach(async ({ page }) => {
    // Modules like Library/Templates/Lab fetch on mount; keep the API mocked
    await installApiMocks(page);
  });
  for (const { title, id } of PROMPT_MODULES) {
    test(`prompt engine: ${title} renders content`, async ({ page }) => {
      await page.goto("/");
      await page.locator("aside").getByRole("button", { name: title, exact: true }).click();
      await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
      await expect(page.getByText(`Prompt Engine module: ${id}`)).toBeVisible();
      const section = page.locator("section");
      await expect(section).toBeVisible();
      // Every module owns at least one interactive control
      await expect(section.locator("textarea, input, button, select").first()).toBeVisible();
    });
  }
  for (const { title, id } of SKILL_MODULES) {
    test(`skill engine: ${title} renders content`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Skills Engine", exact: true }).click();
      await page.locator("aside").getByRole("button", { name: title, exact: true }).click();
      await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
      await expect(page.getByText(`Skills Engine module: ${id}`)).toBeVisible();
      const section = page.locator("section");
      await expect(section).toBeVisible();
      await expect(section.locator("textarea, input, button, select").first()).toBeVisible();
    });
  }
});
