import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/templates";
import type { Template } from "@shared/types";
import { isNonEmptyString, parseJsonBody } from "../lib/validate";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  try {
    const data = await repo.listTemplates(c.env.DB);
    return c.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const item = await repo.getTemplate(c.env.DB, c.req.param("id"));
    if (!item) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: item });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await parseJsonBody<Omit<Template, "id" | "createdAt" | "updatedAt">>(c);
    if (!isNonEmptyString(body?.name) || !isNonEmptyString(body?.body)) {
      return c.json({ ok: false, error: "Missing required fields: name, body" }, 400);
    }
    const created = await repo.createTemplate(c.env.DB, body);
    return c.json({ ok: true, data: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.put("/:id", async (c) => {
  try {
    const body = await parseJsonBody<Partial<Template>>(c);
    if (body?.name !== undefined && !isNonEmptyString(body.name)) {
      return c.json({ ok: false, error: "Invalid field: name" }, 400);
    }
    if (body?.body !== undefined && !isNonEmptyString(body.body)) {
      return c.json({ ok: false, error: "Invalid field: body" }, 400);
    }
    const updated = await repo.updateTemplate(c.env.DB, c.req.param("id"), body);
    if (!updated) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.delete("/:id", async (c) => {
  try {
    const ok = await repo.deleteTemplate(c.env.DB, c.req.param("id"));
    if (!ok) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

export default app;
