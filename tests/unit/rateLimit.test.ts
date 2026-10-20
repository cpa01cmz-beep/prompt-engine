import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../src/worker/env";
import { rateLimitMiddleware } from "../../src/worker/middleware/rateLimit";

type AnyHono = Hono<{ Bindings: Env }>;

function makeApp(_env: unknown): AnyHono {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", rateLimitMiddleware());
  app.post("/api/thing", (c) => c.json({ ok: true, data: { mutation: true } }));
  app.put("/api/thing", (c) => c.json({ ok: true, data: { mutation: true } }));
  app.get("/api/thing", (c) => c.json({ ok: true, data: { read: true } }));
  return app;
}

function request(app: AnyHono, env: unknown, method: "GET" | "POST" | "PUT", path = "/api/thing") {
  return app.request(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      ...(method === "GET" ? {} : { body: "{}" }),
    },
    env as never,
  );
}

describe("rateLimitMiddleware", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("CACHE binding missing (fail closed / fail open)", () => {
    const env = { DB: {} } as unknown;

    it("warns only once even across multiple requests", async () => {
      const app = makeApp(env);
      await request(app, env, "POST");
      await request(app, env, "POST");
      await request(app, env, "GET");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0]?.[0])).toContain("CACHE binding missing");
    });

    it("fails CLOSED for mutating methods with a 503 and does not leak internals", async () => {
      const app = makeApp(env);
      const post = await request(app, env, "POST");
      expect(post.status).toBe(503);
      expect(await post.json()).toEqual({ ok: false, error: "Service temporarily unavailable" });
      // Every mutating method gets the same fail-closed treatment.
      expect((await request(app, env, "PUT")).status).toBe(503);
    });

    it("fails OPEN for read methods so the app stays usable for reads", async () => {
      const app = makeApp(env);
      const res = await request(app, env, "GET");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, data: { read: true } });
    });

    it("skips non-API paths entirely", async () => {
      const app = makeApp(env);
      app.post("/other", (c) => c.json({ ok: true }));
      const app2 = app as AnyHono;
      const res = await app2.request("/other", { method: "POST", body: "{}" }, env as never);
      expect(res.status).toBe(200);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("CACHE binding present", () => {
    function fakeKv(count: string) {
      return {
        get: async () => count,
        put: vi.fn(async () => {}),
      };
    }

    it("limits mutations at the configured budget", async () => {
      const env = { DB: {}, CACHE: fakeKv("60") } as unknown;
      const app = makeApp(env);
      const res = await request(app, env, "POST");
      expect(res.status).toBe(429);
      expect(await res.json()).toEqual({ ok: false, error: "Rate limit exceeded" });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("passes mutations through and increments the counter below the budget", async () => {
      const kv = fakeKv("0");
      const env = { DB: {}, CACHE: kv } as unknown;
      const app = makeApp(env);
      const res = await request(app, env, "POST");
      expect(res.status).toBe(200);
      expect(kv.put).toHaveBeenCalledTimes(1);
    });

    it("passes reads through", async () => {
      const env = { DB: {}, CACHE: fakeKv("0") } as unknown;
      const app = makeApp(env);
      const res = await request(app, env, "GET");
      expect(res.status).toBe(200);
    });
  });
});
