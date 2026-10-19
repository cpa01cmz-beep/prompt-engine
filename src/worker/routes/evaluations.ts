import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/evaluations";
import type { Evaluation } from "@shared/types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const targetType = c.req.query("targetType");
  const targetId = c.req.query("targetId");
  const data = await repo.listEvaluations(c.env.DB, targetType ?? undefined, targetId ?? undefined);
  return c.json({ ok: true, data });
});

app.post("/", async (c) => {
  const body = (await c.req.json()) as Omit<Evaluation, "id" | "createdAt">;
  const created = await repo.createEvaluation(c.env.DB, body);
  return c.json({ ok: true, data: created }, 201);
});

export default app;
