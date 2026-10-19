import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/evaluations";
import { EvaluationInputSchema } from "../schemas";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  try {
    const targetType = c.req.query("targetType");
    const targetId = c.req.query("targetId");
    const data = await repo.listEvaluations(c.env.DB, targetType ?? undefined, targetId ?? undefined);
    return c.json({ ok: true, data });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

app.get("/:id", async (c) => {
  try {
    // evaluations repo has no get by id; list and find
    const all = await repo.listEvaluations(c.env.DB);
    const item = all.find((e) => e.id === c.req.param("id"));
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
    const parsed = EvaluationInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const created = await repo.createEvaluation(c.env.DB, {
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      score: parsed.data.score ?? null,
      feedback: parsed.data.feedback,
      model: parsed.data.model,
    });
    return c.json({ ok: true, data: created }, 201);
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

export default app;
