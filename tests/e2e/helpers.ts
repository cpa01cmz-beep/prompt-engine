import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** The h1 is rendered by React, so its visibility doubles as a hydration signal. */
export function appShell(page: Page) {
  return page.getByRole("heading", { name: "Prompt & Skills Engine" });
}

/** Navigate with mocks installed; returns the module panel and the mock mixer. */
export async function openApp(
  page: Page,
  { mock = true }: { mock?: boolean } = {},
) {
  if (mock) await installApiMocks(page);
  await page.goto("/");
  // This proves React rendered the app, so hydration-driven clicks are safe.
  await expect(appShell(page)).toBeVisible({ timeout: 30_000 });
  return { panel: page.locator("section") };
}

/** The module panel: everything the user interacts with inside the active module. */
export function panel(page: Page) {
  return page.locator("section");
}


export type MockResponse = { status?: number; body: unknown };

type Handler = (req: { method: string; url: URL }) => MockResponse | Promise<MockResponse>;

const DEFAULT_PROMPTS = [
  { id: "p1", title: "Prompt One", content: "Hello prompt", version: 1, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: "p2", title: "Prompt Two", content: "Second prompt body", version: 1, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
];

const DEFAULT_SKILLS = [
  { id: "s1", name: "Skill One", description: "First skill", instructions: "Do things", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
];

const DEFAULT_TEMPLATES = [
  { id: "t1", name: "Template One", body: "Hello {{name}}", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
];

const DEFAULT_SEARCH = {
  query: "q",
  results: [
    { title: "Result Alpha", url: "https://example.com/alpha", snippet: "Alpha snippet" },
    { title: "Result Beta", url: "https://example.com/beta", snippet: "Beta snippet" },
  ],
};

function ok(body: unknown): MockResponse {
  // api.request() unwraps the { ok, data } envelope, so mock the full envelope
  return { status: 200, body: { ok: true, data: body } };
}

function defaultHandler(key: string): MockResponse | undefined {
  switch (key) {
    case "GET /api/prompts":
      return ok(DEFAULT_PROMPTS);
    case "GET /api/skills":
      return ok(DEFAULT_SKILLS);
    case "GET /api/templates":
      return ok(DEFAULT_TEMPLATES);
    case "GET /api/auth/me":
      // The Login gate in App.tsx trusts a token + this endpoint; return an
      // authenticated admin-shaped user so specs skip the real auth backend.
      return ok({ id: "u-e2e", username: "e2e-user", role: "admin" });
    case "POST /api/ai/chat":
      return ok({ content: "Mocked AI response" });
    case "POST /api/ai/generate-prompt":
      return ok({ content: "Generated prompt content" });
    case "POST /api/ai/evaluate-prompt":
      return ok({ content: "Score: 8/10 - Looks good" });
    case "POST /api/ai/optimize-prompt":
      return ok({ content: "Optimized prompt content" });
    case "POST /api/ai/generate-skill":
      return ok({ content: "Generated skill content" });
    case "POST /api/ai/evaluate-skill":
      return ok({ content: "Score: 7/10 - Fine" });
    case "POST /api/ai/optimize-skill":
      return ok({ content: "Optimized skill content" });
    case "GET /api/search/web":
      return ok(DEFAULT_SEARCH);
    case "POST /api/prompts":
      return ok({ id: "p-new", title: "Generated prompt", content: "Generated prompt content", version: 1, createdAt: "2024-01-01", updatedAt: "2024-01-01" });
    case "PUT /api/prompts/p1":
    case "PUT /api/prompts/p2":
      return ok({ id: key.split("/").pop(), title: "Prompt One", content: "Hello prompt", version: 2, createdAt: "2024-01-01", updatedAt: "2024-01-01" });
    case "DELETE /api/prompts/p1":
    case "DELETE /api/prompts/p2":
      return ok(null);
    case "POST /api/templates":
      return ok({ id: "t-new", name: "New Template", body: "Hello {{name}}", createdAt: "2024-01-01", updatedAt: "2024-01-01" });
    case "DELETE /api/templates/t1":
      return ok(null);
    case "POST /api/skills":
      return ok({ id: "s-new", name: "Generated skill", description: "", instructions: "Generated skill content", createdAt: "2024-01-01", updatedAt: "2024-01-01" });
    case "PUT /api/skills/s1":
      return ok({ id: "s1", name: "Skill One", description: "First skill", instructions: "Do things", createdAt: "2024-01-01", updatedAt: "2024-01-01" });
    case "DELETE /api/skills/s1":
      return ok(null);
    default:
      return undefined;
  }
}

export async function openPromptCreator(page: Page) {
  const api = await installApiMocks(page);
  await page.goto("/");
  await expect(appShell(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Goal")).toBeVisible();
  return { api, panel: panel(page) };
}

export async function openSkillCreator(page: Page) {
  const api = await installApiMocks(page);
  await page.goto("/");
  await expect(appShell(page)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Skills Engine" }).click();
  await page.locator("aside").getByRole("button", { name: "Creator" }).click();
  await expect(page.getByLabel("Goal")).toBeVisible();
  return { api, panel: panel(page) };
}

export async function openPromptLibrary(page: Page) {
  await installApiMocks(page);
  await page.goto("/");
  await expect(appShell(page)).toBeVisible({ timeout: 30_000 });
  await page.locator("aside").getByRole("button", { name: "Library" }).click();
  await expect(page.getByText("Prompt One")).toBeVisible();
  await expect(page.getByText("Prompt Two")).toBeVisible();
}

export async function openSkillSearch(page: Page) {
  const api = await installApiMocks(page);
  await page.goto("/");
  await expect(appShell(page)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Skills Engine" }).click();
  return { api, panel: panel(page) };
}

export async function installApiMocks(page: Page) {
  const handlers = new Map<string, Handler>();
  const set = (pattern: string, handler: Handler | MockResponse) => {
    handlers.set(pattern, typeof handler === "function" ? (handler as Handler) : () => handler as MockResponse);
  };

  // Defaults
  for (const key of [
    "GET /api/prompts",
    "GET /api/skills",
    "GET /api/templates",
    "GET /api/auth/me",
    "POST /api/ai/chat",
    "POST /api/ai/generate-prompt",
    "POST /api/ai/evaluate-prompt",
    "POST /api/ai/optimize-prompt",
    "POST /api/ai/generate-skill",
    "POST /api/ai/evaluate-skill",
    "POST /api/ai/optimize-skill",
    "GET /api/search/web",
    "POST /api/prompts",
    "POST /api/templates",
    "POST /api/skills",
  ]) {
    const resp = defaultHandler(key);
    if (resp) set(key, resp);
  }
  // Default handlers that depend on path (PUT/DELETE on any id) via ANY fallback
  set("ANY /api/prompts/*", (req) => {
    if (req.method === "PUT") return ok({ id: req.url.pathname.split("/").pop(), title: "Prompt One", content: "Hello prompt", version: 2, createdAt: "2024-01-01", updatedAt: "2024-01-01" });
    if (req.method === "DELETE") return ok(null);
    return { status: 404, body: { ok: false, error: "Not found" } };
  });
  set("ANY /api/skills/*", (req) => {
    if (req.method === "PUT") return ok({ id: req.url.pathname.split("/").pop(), name: "Skill One", description: "First skill", instructions: "Do things", createdAt: "2024-01-01", updatedAt: "2024-01-01" });
    if (req.method === "DELETE") return ok(null);
    return { status: 404, body: { ok: false, error: "Not found" } };
  });
  set("ANY /api/templates/*", (req) => {
    if (req.method === "DELETE") return ok(null);
    return { status: 404, body: { ok: false, error: "Not found" } };
  });

  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const key = `${req.method()} ${url.pathname}`;
    // query-bearing GET /api/prompts?q=... still path /api/prompts
    let handler = handlers.get(key);
    if (!handler) {
      // try ANY path pattern
      // exact ANY /api/x/* handled below by prefix matching
      handler = handlers.get(`ANY ${url.pathname}`);
    }
    if (!handler) {
      // prefix match for wildcard entries
      for (const [k, h] of handlers) {
        if (k.startsWith("ANY ")) {
          const pattern = k.slice(4);
          if (pattern.endsWith("/*")) {
            const base = pattern.slice(0, -2);
            if (url.pathname.startsWith(base + "/")) {
              handler = h;
              break;
            }
          }
        }
      }
    }
    if (!handler) {
      await route.fulfill({ status: 501, contentType: "application/json", body: JSON.stringify({ ok: false, error: `Unmocked: ${key}` }) });
      return;
    }
    const res = await handler({ method: req.method(), url });
    await route.fulfill({
      status: res.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(res.body),
    });
  });

  return {
    set: (pattern: string, handler: Handler | MockResponse) => {
      handlers.set(pattern, typeof handler === "function" ? (handler as Handler) : () => handler as MockResponse);
      return;
    },
  };
}
