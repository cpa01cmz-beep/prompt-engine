import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";

const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

// A missing CACHE binding is a deployment misconfiguration, not a per-request
// condition — warn once per isolate instead of once per request.
let missingCacheWarned = false;

export function rateLimitMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    // Rate limit all /api calls: beyond the AI cost gate this protects the D1
    // database and settings store from unauthenticated request floods. GETs get
    // their own higher-budget bucket so reads stay smooth for real clients.
    if (!c.req.path.startsWith("/api/")) return next();
    const method = c.req.method;
    const isMutation = MUTATING_METHODS.includes(method);
    const kv = c.env?.CACHE;
    if (!kv) {
      if (!missingCacheWarned) {
        missingCacheWarned = true;
        console.warn("Rate limiter: CACHE binding missing; failing closed for mutating requests");
      }
      // Fail CLOSED for mutating methods: without a KV counter we cannot
      // enforce the write budget, and mutations (D1 writes, AI spend, settings
      // changes) are the expensive and abuse-prone surface. A 503 keeps a
      // misconfigured deployment from becoming an unlimited write amplifier.
      if (isMutation) {
        return c.json({ ok: false, error: "Service temporarily unavailable" }, 503);
      }
      // Fail OPEN for reads, and only here. Rationale: reads are idempotent
      // and read-only — no data can be corrupted or expensive quota consumed
      // — and blocking every GET would make the entire application unusable
      // while a deployment misconfiguration is being fixed. Mutating routes
      // stay protected by the fail-closed branch above, and the AI cost gate
      // in the AI routes still applies to AI requests.
      return next();
    }
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
