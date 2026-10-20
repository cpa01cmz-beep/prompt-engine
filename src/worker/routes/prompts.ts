import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/prompts";
import { clampListLimit } from "../db/utils";
import { PromptInputSchema, PromptUpdateSchema } from "../schemas";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  try {
    const search = c.req.query("q");
    const data = await repo.listPrompts(
      c.env.DB,
      search ?? undefined,
      clampListLimit(c.req.query("limit")),
    );
    return c.json({ ok: true, data });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const item = await repo.getPrompt(c.env.DB, c.req.param("id"));
    if (!item) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: item });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = PromptInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const created = await repo.createPrompt(c.env.DB, parsed.data);
    return c.json({ ok: true, data: created }, 201);
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

app.put("/:id", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = PromptUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const updated = await repo.updatePrompt(c.env.DB, c.req.param("id"), parsed.data);
    if (!updated) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: updated });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

app.delete("/:id", async (c) => {
  try {
    const ok = await repo.deletePrompt(c.env.DB, c.req.param("id"));
    if (!ok) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: null });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

export default app;
