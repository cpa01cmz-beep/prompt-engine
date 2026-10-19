import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/evaluations";
import type { Evaluation } from "@shared/types";
import { isNonEmptyString, parseJsonBody } from "../lib/validate";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  try {
    const targetType = c.req.query("targetType");
    const targetId = c.req.query("targetId");
    const data = await repo.listEvaluations(c.env.DB, targetType ?? undefined, targetId ?? undefined);
    return c.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await parseJsonBody<Omit<Evaluation, "id" | "createdAt">>(c);
    if (!isNonEmptyString(body?.targetType) || !isNonEmptyString(body?.targetId)) {
      return c.json({ ok: false, error: "Missing required fields: targetType, targetId" }, 400);
    }
    const created = await repo.createEvaluation(c.env.DB, body);
    return c.json({ ok: true, data: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

export default app;
