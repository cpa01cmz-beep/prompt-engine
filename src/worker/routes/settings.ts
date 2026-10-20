import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/settings";
import { SettingsValueSchema } from "../schemas";
import { parseAiProvider } from "../services/aiProvider";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  try {
    const data = await repo.listSettings(c.env.DB);
    return c.json({ ok: true, data });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

app.get("/:key", async (c) => {
  try {
    const key = c.req.param("key");
    if (isRejectedKey(key)) {
      return c.json({ ok: false, error: "Key not allowed" }, 400);
    }
    const value = await repo.getSettingTyped(c.env.DB, key);
    if (value === null) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: { key, value } });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

// Settings are writable through an unauthenticated endpoint, so the key space
// must stay small and secret-free. Settings must never store credentials (the
// AI config reads secrets from env only) and abusive values must be bounded.
const ALLOWED_KEY_RE = /^[A-Za-z0-9._-]{1,64}$/;
const FORBIDDEN_KEY_RE = /(api[_-]?key|secret|token|password|credential)/i;
const MAX_VALUE_BYTES = 16384;

// Settings are writable by anonymous users, so the key space must stay minimal:
// only keys the app actually consumes get written. Everything else (including
// legacy OPENAI_* keys) is rejected with 400 instead of being stored.
const WRITABLE_KEYS = new Set(["ai.provider"]);

function isRejectedKey(key: string): boolean {
  return !ALLOWED_KEY_RE.test(key) || FORBIDDEN_KEY_RE.test(key);
}

app.put("/:key", async (c) => {
  try {
    const key = c.req.param("key");
    if (!key) return c.json({ ok: false, error: "Missing required param: key" }, 400);
    if (isRejectedKey(key) || !WRITABLE_KEYS.has(key)) {
      return c.json({ ok: false, error: "Key not allowed" }, 400);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: "Invalid JSON body" }, 400);
    }
    const parsed = SettingsValueSchema.safeParse(body);
    if (!parsed.success || !parsed.data) {
      return c.json({ ok: false, error: parsed.success ? "Invalid body" : parsed.error.message }, 400);
    }
    // The value space mirrors what the app reads back. `ai.provider` is the
    // only writable key and it must be a vetted provider shape (https origins
    // only) — anything else is rejected before it reaches D1.
    if (key === "ai.provider" && !parseAiProvider(parsed.data.value, c.env)) {
      return c.json({ ok: false, error: "Invalid provider configuration" }, 400);
    }
    const serialized = JSON.stringify(parsed.data.value);
    // JSON.stringify returns `undefined` for `undefined` inputs; guard against
    // that (and any other non-serializable value) instead of dereferencing it.
    if (serialized === undefined) {
      return c.json({ ok: false, error: "Value is not JSON-serializable" }, 400);
    }
    if (new TextEncoder().encode(serialized).length > MAX_VALUE_BYTES) {
      return c.json({ ok: false, error: "Value too large" }, 400);
    }
    await repo.setSettingTyped(c.env.DB, key, parsed.data.value);
    return c.json({ ok: true, data: { key, value: parsed.data.value } });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

export default app;
