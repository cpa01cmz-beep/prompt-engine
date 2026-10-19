import { Hono } from "hono";
import type { Env } from "./env";
import { securityHeaders } from "./middleware/security";
import { corsMiddleware } from "./middleware/cors";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import health from "./routes/health";
import prompts from "./routes/prompts";
import templates from "./routes/templates";
import skills from "./routes/skills";
import evaluations from "./routes/evaluations";
import settings from "./routes/settings";
import ai from "./routes/ai";
import search from "./routes/search";

const app = new Hono<{ Bindings: Env }>();

app.use("*", securityHeaders());
app.use("*", corsMiddleware());
app.use("*", rateLimitMiddleware());

app.onError((err, c) => {
  // Log full detail server-side only; never reflect internal error text
  // (provider responses, D1 errors, stack details) to public API clients.
  console.error("Unhandled worker error:", err);
  return c.json({ ok: false, error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ ok: false, error: "Not found" }, 404));

app.route("/api/health", health);
app.route("/api/prompts", prompts);
app.route("/api/templates", templates);
app.route("/api/skills", skills);
app.route("/api/evaluations", evaluations);
app.route("/api/settings", settings);
app.route("/api/ai", ai);
app.route("/api/search", search);

// Fallback to static assets
app.all("*", async (c) => {
  if (c.env?.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.json({ ok: false, error: "Not found" }, 404);
});

export default app;
