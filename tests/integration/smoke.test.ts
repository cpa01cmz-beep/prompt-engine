import { describe, it, expect } from "vitest";
import app from "../../src/worker/index";

const mockEnv = {
  DB: {} as unknown,
  CACHE: undefined as unknown,
  ASSETS: { fetch: async () => new Response("not found", { status: 404 }) } as unknown,
};

describe("integration smoke", () => {
  it("health ok", async () => {
    const res = await app.request("/api/health", {}, mockEnv as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("ok");
  });

  it("validation failure returns 400", async () => {
    const res = await app.request(
      "/api/prompts",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "" }) },
      mockEnv as never,
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(false);
  });
});
