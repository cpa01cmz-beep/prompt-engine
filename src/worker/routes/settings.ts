import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/settings";
import { SettingsValueSchema } from "../schemas";

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

app.get("/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const value = await repo.getSettingTyped(c.env.DB, key);
    if (value === null) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: { key, value } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.put("/:key", async (c) => {
  try {
    const key = c.req.param("key");
    if (!key) return c.json({ ok: false, error: "Missing required param: key" }, 400);
    const body = await c.req.json();
    const parsed = SettingsValueSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    await repo.setSettingTyped(c.env.DB, key, parsed.data.value);
    return c.json({ ok: true, data: { key, value: parsed.data.value } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

export default app;
