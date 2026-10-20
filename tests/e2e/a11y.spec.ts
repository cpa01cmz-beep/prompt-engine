import { test, expect } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { installApiMocks } from "./helpers";

async function scan(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(" > ")),
  }));
  // Debuggable output on failure without rerunning
  expect(results.violations.map((v) => v.id), JSON.stringify(violations, null, 2)).toEqual([]);
}

test.describe("accessibility (axe)", () => {
  test("home screen has no WCAG A/AA violations", async ({ page }) => {
    await installApiMocks(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Prompt & Skills Engine" })).toBeVisible();
    await scan(page);
  });

  for (const { engine, title } of [
    { engine: "prompt", title: "Library" },
    { engine: "prompt", title: "Templates" },
    { engine: "prompt", title: "Compare" },
    { engine: "skill", title: "Search" },
    { engine: "skill", title: "Lab" },
    { engine: "skill", title: "Creator" },
  ] as const) {
    test(`${engine} engine: ${title} screen has no WCAG A/AA violations`, async ({ page }) => {
      await installApiMocks(page);
      await page.goto("/");
      if (engine === "skill") {
        await page.getByRole("button", { name: "Skills Engine" }).click();
      }
      await page.locator("aside").getByRole("button", { name: title, exact: true }).click();
      await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
      await scan(page);
    });
  }
});
