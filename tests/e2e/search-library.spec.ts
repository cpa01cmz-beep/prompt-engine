import { test, expect } from "@playwright/test";
import { installApiMocks, openPromptLibrary, openSkillSearch } from "./helpers";

test.describe("skill search flow", () => {
  test("renders mocked results with links", async ({ page }) => {
    const { panel } = await openSkillSearch(page);

    const search = page.waitForResponse(
      (r) => r.url().includes("/api/search/web") && r.status() === 200,
    );
    await page.getByLabel("Query").fill("prompt engineering");
    await panel.getByRole("button", { name: "Search", exact: true }).click();
    const res = await search;

    // Request carried the URL-encoded query
    expect(new URL(res.request().url()).searchParams.get("q")).toBe("prompt engineering");

    await expect(page.getByRole("link", { name: "Result Alpha" })).toHaveAttribute(
      "href",
      "https://example.com/alpha",
    );
    await expect(page.getByRole("link", { name: "Result Beta" })).toBeVisible();
    await expect(page.getByText("Alpha snippet")).toBeVisible();
  });

  test("search errors surface and can recover", async ({ page }) => {
    const { api, panel } = await openSkillSearch(page);
    api.set("GET /api/search/web", { status: 500, body: { ok: false, error: "Search unavailable" } });

    await page.getByLabel("Query").fill("prompt engineering");
    await panel.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("Search unavailable")).toBeVisible();

    api.set("GET /api/search/web", {
      status: 200,
      body: { ok: true, data: { query: "", results: [{ title: "Recovered", url: "https://example.com/x", snippet: "ok" }] } },
    });
    await panel.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("link", { name: "Recovered" })).toBeVisible();
  });

  test("empty result list is communicated", async ({ page }) => {
    const { api, panel } = await openSkillSearch(page);
    api.set("GET /api/search/web", { status: 200, body: { ok: true, data: { query: "", results: [] } } });

    await page.getByLabel("Query").fill("very obscure topic");
    await panel.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("No results.")).toBeVisible();
  });
});

test.describe("prompt library flow", () => {
  test("loads list, edits and saves with success", async ({ page }) => {
    await openPromptLibrary(page);

    await page.getByRole("button", { name: "Prompt One" }).click();
    await expect(page.getByLabel("Title")).toHaveValue("Prompt One");
    await expect(page.getByLabel("Content")).toHaveValue("Hello prompt");

    const save = page.waitForResponse(
      (r) => r.url().includes("/api/prompts/p1") && r.request().method() === "PUT",
    );
    await page.getByLabel("Title").fill("Prompt One Edited");
    await page.getByRole("button", { name: "Save changes" }).click();
    await save;
    await expect(page.getByText("Updated.")).toBeVisible();
  });

  test("search button queries the API with the entered term", async ({ page }) => {
    await openPromptLibrary(page);

    let requestedQuery = "";
    await page.route(/\/api\/prompts\?/, (route) => {
      const req = route.request();
      if (req.method() !== "GET") return route.fallback();
      requestedQuery = new URL(req.url()).searchParams.get("q") ?? "";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: [
            { id: "p1", title: "Prompt One", content: "Hello prompt", version: 1, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
          ],
        }),
      });
    });

    await page.getByLabel("Search").fill("hello");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect.poll(async () => requestedQuery).toBe("hello");
    await expect(page.getByText("Prompt Two")).toBeHidden();
    await expect(page.getByText("Prompt One")).toBeVisible();
  });

  test("delete removes the item and shows success", async ({ page }) => {
    await openPromptLibrary(page);

    const del = page.waitForResponse(
      (r) => r.url().includes("/api/prompts/p2") && r.request().method() === "DELETE",
    );
    const cardTwo = page.locator("div.cursor-pointer").filter({ hasText: "Prompt Two" });
    await cardTwo.getByRole("button", { name: "Delete" }).click();
    await del;
    await expect(page.getByText("Deleted.")).toBeVisible();
    await expect(page.getByText("Prompt Two")).toBeHidden();
  });

  test("save failure surfaces the API error", async ({ page }) => {
    await openPromptLibrary(page);

    await page.getByRole("button", { name: "Prompt One" }).click();
    await expect(page.getByLabel("Title")).toHaveValue("Prompt One");

    await page.route("**/api/prompts/p1", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Update failed" }),
      }),
    );

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Update failed")).toBeVisible();
  });
});

test.describe("prompt library error on load", () => {
  test("load failure surfaces before user actions", async ({ page }) => {
    await installApiMocks(page);
    await page.route(/\/api\/prompts$/, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Library unavailable" }),
      }),
    );
    await page.goto("/");
    await page.locator("aside").getByRole("button", { name: "Library" }).click();
    await expect(page.getByText("Library unavailable")).toBeVisible();
  });
});
