import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "./env";
import health from "./routes/health";
import prompts from "./routes/prompts";
import templates from "./routes/templates";
import skills from "./routes/skills";
import evaluations from "./routes/evaluations";
import settings from "./routes/settings";
import ai from "./routes/ai";
import search from "./routes/search";

const app = new Hono<{ Bindings: Env }>();

app.use("*", secureHeaders());
app.use("*", cors());

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
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
