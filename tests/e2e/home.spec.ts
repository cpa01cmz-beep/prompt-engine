import { test, expect } from "@playwright/test";

test.describe("home", () => {
  test("loads and shows the default prompt engine view", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Prompt & Skills Engine" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Prompt Engine" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skills Engine" })).toBeVisible();

    // Default module is Creator on the prompt engine
    await expect(page.getByRole("heading", { name: "Creator", level: 2 })).toBeVisible();
    await expect(page.getByText("Prompt Engine module: creator")).toBeVisible();

    // Creator form is reachable without any network calls
    await expect(page.getByLabel("Goal")).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate" })).toBeVisible();
  });

  test("engines switch and reset to their first module", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Skills Engine" }).click();
    await expect(page.getByRole("heading", { name: "Search", level: 2 })).toBeVisible();
    await expect(page.getByText("Skills Engine module: search")).toBeVisible();
    await expect(page.getByLabel("Query")).toBeVisible();

    await page.getByRole("button", { name: "Prompt Engine" }).click();
    await expect(page.getByRole("heading", { name: "Creator", level: 2 })).toBeVisible();
    await expect(page.getByText("Prompt Engine module: creator")).toBeVisible();
  });
});
