import { test, expect } from "./fixtures";
import { installApiMocks } from "./helpers";

/**
 * Console/pageerror hygiene probe (Gate 3).
 *
 * Walks the primary prompt-creation journey under API mocks and fails if the
 * app emits any uncaught page error or console error. Mocks are installed
 * before navigation so no request escapes to the real worker.
 */
test.describe("console hygiene", () => {
  test("primary journey emits no pageerror or console error", async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    // Listeners must be attached before navigation to catch hydration errors.
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await installApiMocks(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Prompt & Skills Engine" })).toBeVisible({
      timeout: 30_000,
    });

    // Primary CTA from the landing panel into the prompt creator.
    const cta = page.getByRole("button", { name: "Start creating a prompt" });
    await expect(cta).toBeVisible();
    await cta.click();

    const panel = page.locator("section");
    await panel.getByRole("button", { name: "Add context" }).click();

    await page.getByLabel("Goal").fill("Write a launch email");
    await page.getByLabel("Role").fill("senior marketer");
    await page.getByLabel("Variables (comma separated)").fill("audience, tone");
    await page.getByLabel("Constraints").fill("Under 200 words");
    await page.getByLabel("Examples").fill("Example launch email");

    await panel.getByRole("button", { name: "Generate" }).click();
    // Asserting the mocked result proves the generate round-trip completed.
    await expect(page.getByLabel("Result")).toHaveValue("Generated prompt content");

    expect(pageErrors, `pageerror events:\n${pageErrors.join("\n")}`).toEqual([]);
    expect(consoleErrors, `console.error calls:\n${consoleErrors.join("\n")}`).toEqual([]);
  });
});
