import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";

export function rateLimitMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    // Rate limit all /api calls: beyond the AI cost gate this protects the D1
    // database and settings store from unauthenticated request floods. GETs get
    // their own higher-budget bucket so reads stay smooth for real clients.
    if (!c.req.path.startsWith("/api/")) return next();
    const method = c.req.method;
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    const kv = c.env?.CACHE;
    if (!kv) return next();
    // Only trust the edge-provided connecting IP. Header fallbacks such as
    // x-forwarded-for are client-settable and would let callers rotate fake
    // identities; without a trusted IP all callers share one strict bucket.
    const ip = c.req.header("cf-connecting-ip");
    const scope = ip ? `ip:${ip}` : "anonymous";
    const bucket = isMutation ? "write" : "read";
    const limit = isMutation ? 60 : 240;
    const minute = Math.floor(Date.now() / 60000);
    const key = `rl:${bucket}:${scope}:${minute}`;
    const current = parseInt((await kv.get(key)) || "0", 10);
    if (current >= limit) {
      return c.json({ ok: false, error: "Rate limit exceeded" }, 429);
    }
    await kv.put(key, String(current + 1), { expirationTtl: 120 });
    return next();
  };
}
