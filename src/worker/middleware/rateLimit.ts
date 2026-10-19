import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";

export function rateLimitMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    if (!c.req.path.startsWith("/api/ai/")) return next();
    const kv = c.env?.CACHE;
    if (!kv) return next();
    const ip =
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const minute = Math.floor(Date.now() / 60000);
    const key = `rl:${ip}:${minute}`;
    const current = parseInt((await kv.get(key)) || "0", 10);
    if (current >= 60) {
      return c.json({ ok: false, error: "Rate limit exceeded" }, 429);
    }
    await kv.put(key, String(current + 1), { expirationTtl: 120 });
    return next();
  };
}
