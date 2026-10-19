import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/prompts";
import type { Prompt } from "@shared/types";
import { isNonEmptyString, parseJsonBody } from "../lib/validate";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  try {
    const search = c.req.query("q");
    const data = await repo.listPrompts(c.env.DB, search ?? undefined);
    return c.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const item = await repo.getPrompt(c.env.DB, c.req.param("id"));
    if (!item) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: item });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await parseJsonBody<Omit<Prompt, "id" | "version" | "createdAt" | "updatedAt">>(c);
    if (!isNonEmptyString(body?.title) || !isNonEmptyString(body?.content)) {
      return c.json({ ok: false, error: "Missing required fields: title, content" }, 400);
    }
    const created = await repo.createPrompt(c.env.DB, body);
    return c.json({ ok: true, data: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.put("/:id", async (c) => {
  try {
    const body = await parseJsonBody<Partial<Prompt>>(c);
    if (body?.title !== undefined && !isNonEmptyString(body.title)) {
      return c.json({ ok: false, error: "Invalid field: title" }, 400);
    }
    if (body?.content !== undefined && !isNonEmptyString(body.content)) {
      return c.json({ ok: false, error: "Invalid field: content" }, 400);
    }
    const updated = await repo.updatePrompt(c.env.DB, c.req.param("id"), body);
    if (!updated) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.delete("/:id", async (c) => {
  try {
    const ok = await repo.deletePrompt(c.env.DB, c.req.param("id"));
    if (!ok) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

export default app;
