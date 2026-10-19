import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/skills";
import type { Skill } from "@shared/types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const search = c.req.query("q");
  const data = await repo.listSkills(c.env.DB, search ?? undefined);
  return c.json({ ok: true, data });
});

app.get("/:id", async (c) => {
  const item = await repo.getSkill(c.env.DB, c.req.param("id"));
  if (!item) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true, data: item });
});

app.post("/", async (c) => {
  const body = (await c.req.json()) as Omit<Skill, "id" | "createdAt" | "updatedAt">;
  const created = await repo.createSkill(c.env.DB, body);
  return c.json({ ok: true, data: created }, 201);
});

app.put("/:id", async (c) => {
  const body = (await c.req.json()) as Partial<Skill>;
  const updated = await repo.updateSkill(c.env.DB, c.req.param("id"), body);
  if (!updated) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true, data: updated });
});

app.delete("/:id", async (c) => {
  const ok = await repo.deleteSkill(c.env.DB, c.req.param("id"));
  if (!ok) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true, data: null });
});

export default app;
