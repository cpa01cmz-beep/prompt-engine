import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/settings";
import { isNonEmptyString, parseJsonBody } from "../lib/validate";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  try {
    const data = await repo.listSettings(c.env.DB);
    return c.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.put("/:key", async (c) => {
  try {
    const key = c.req.param("key");
    if (!isNonEmptyString(key)) {
      return c.json({ ok: false, error: "Missing required param: key" }, 400);
    }
    const body = await parseJsonBody<{ value: string }>(c);
    if (typeof body?.value !== "string") {
      return c.json({ ok: false, error: "Missing required field: value" }, 400);
    }
    await repo.setSetting(c.env.DB, key, body.value);
    return c.json({ ok: true, data: { key, value: body.value } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

export default app;
