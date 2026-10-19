import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/templates";
import type { Template } from "@shared/types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const data = await repo.listTemplates(c.env.DB);
  return c.json({ ok: true, data });
});

app.get("/:id", async (c) => {
  const item = await repo.getTemplate(c.env.DB, c.req.param("id"));
  if (!item) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true, data: item });
});

app.post("/", async (c) => {
  const body = (await c.req.json()) as Omit<Template, "id" | "createdAt" | "updatedAt">;
  const created = await repo.createTemplate(c.env.DB, body);
  return c.json({ ok: true, data: created }, 201);
});

app.put("/:id", async (c) => {
  const body = (await c.req.json()) as Partial<Template>;
  const updated = await repo.updateTemplate(c.env.DB, c.req.param("id"), body);
  if (!updated) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true, data: updated });
});

app.delete("/:id", async (c) => {
  const ok = await repo.deleteTemplate(c.env.DB, c.req.param("id"));
  if (!ok) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true, data: null });
});

export default app;
