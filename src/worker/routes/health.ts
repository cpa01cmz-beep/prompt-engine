import { Hono } from "hono";
import type { Env } from "../env";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  try {
    return c.json({ status: "ok" });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

export default app;
