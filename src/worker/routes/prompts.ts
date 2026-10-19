import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/prompts";
import type { Prompt } from "@shared/types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const search = c.req.query("q");
  const data = await repo.listPrompts(c.env.DB, search ?? undefined);
  return c.json({ ok: true, data });
});

app.get("/:id", async (c) => {
  const item = await repo.getPrompt(c.env.DB, c.req.param("id"));
  if (!item) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true, data: item });
});

app.post("/", async (c) => {
  const body = (await c.req.json()) as Omit<Prompt, "id" | "version" | "createdAt" | "updatedAt">;
  const created = await repo.createPrompt(c.env.DB, body);
  return c.json({ ok: true, data: created }, 201);
});

app.put("/:id", async (c) => {
  const body = (await c.req.json()) as Partial<Prompt>;
  const updated = await repo.updatePrompt(c.env.DB, c.req.param("id"), body);
  if (!updated) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true, data: updated });
});

app.delete("/:id", async (c) => {
  const ok = await repo.deletePrompt(c.env.DB, c.req.param("id"));
  if (!ok) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true, data: null });
});

export default app;
