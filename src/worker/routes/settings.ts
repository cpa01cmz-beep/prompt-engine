import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/settings";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const data = await repo.listSettings(c.env.DB);
  return c.json({ ok: true, data });
});

app.put("/:key", async (c) => {
  const key = c.req.param("key");
  const body = (await c.req.json()) as { value: string };
  await repo.setSetting(c.env.DB, key, body.value);
  return c.json({ ok: true, data: { key, value: body.value } });
});

export default app;
