import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/settings";
import { SettingsValueSchema } from "../schemas";
import { trustedProviderOrigins } from "../services/aiProvider";
import { isPublicHttpsUrl } from "../lib/url";
import * as auth from "../db/auth";

const app = new Hono<{ Bindings: Env }>();

const AUTHED_KEYS = new Set(["ai.provider", "OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL"]);
const MAX_VALUE_BYTES = 16384;

function bearerToken(c: { req: { header: (name: string) => string | undefined } }): string | null {
  const h = c.req.header("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function requireUser(c: { env: Env; req: { header: (name: string) => string | undefined } }): Promise<{ id: string; username: string; role: string } | null> {
  const token = bearerToken(c);
  if (!token) return null;
  return auth.getSessionUser(c.env.DB, token);
}

app.get("/", async (c) => {
  try {
    const user = await requireUser(c);
    if (!user) return c.json({ ok: false, error: "Unauthorized" }, 401);
    const data = await repo.listSettings(c.env.DB);
    return c.json({ ok: true, data });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

app.get("/:key", async (c) => {
  try {
    const user = await requireUser(c);
    if (!user) return c.json({ ok: false, error: "Unauthorized" }, 401);
    const key = c.req.param("key");
    const value = await repo.getSetting(c.env.DB, key);
    if (value === null) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: { key, value } });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

app.put("/:key", async (c) => {
  try {
    const user = await requireUser(c);
    if (!user) return c.json({ ok: false, error: "Unauthorized" }, 401);
    const key = c.req.param("key");
    if (!key || !AUTHED_KEYS.has(key)) {
      return c.json({ ok: false, error: "Key not allowed" }, 400);
    }

    const raw = await c.req.json().catch(() => null);
    const parsed = SettingsValueSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { ok: false, error: parsed.success ? "Invalid body" : parsed.error.message },
        400,
      );
    }

    const value = parsed.data.value;

    if (key === "ai.provider") {
      let provider: unknown = value;
      if (typeof value === "string") {
        try {
          provider = JSON.parse(value);
        } catch {
          provider = undefined;
        }
      }
      const p = (typeof provider === "object" && provider !== null ? provider : {}) as {
        baseUrl?: unknown;
        model?: unknown;
      };
      const shapeOk =
        typeof p.baseUrl === "string" &&
        typeof p.model === "string" &&
        p.baseUrl.trim().length > 0 &&
        p.model.trim().length > 0;
      if (!shapeOk) {
        return c.json({ ok: false, error: "Invalid provider configuration" }, 400);
      }
      const baseUrl = String(p.baseUrl).trim();
      const model = String(p.model).trim();
      if (!isPublicHttpsUrl(baseUrl)) {
        return c.json({ ok: false, error: "Invalid provider configuration" }, 400);
      }
      const target = new URL(baseUrl.replace(/\/+$/, "")).origin;
      if (!trustedProviderOrigins(c.env).has(target)) {
        return c.json(
          {
            ok: false,
            error:
              "Provider origin is not allowed by the operator. Add it to AI_PROVIDER_ALLOWLIST (Cloudflare dashboard → Variables) or set OPENAI_BASE_URL.",
          },
          400,
        );
      }
      const validated = { baseUrl, model };
      const toStore = JSON.stringify({ baseUrl: validated.baseUrl, model: validated.model });
      if (toStore.length > MAX_VALUE_BYTES) {
        return c.json({ ok: false, error: "Value too large" }, 400);
      }
      await repo.setSetting(c.env.DB, key, toStore);
      return c.json({ ok: true, data: { key, value: { baseUrl: validated.baseUrl, model: validated.model } } });
    }

    let strValue: string;
    try {
      strValue = typeof value === "string" ? value : JSON.stringify(value);
    } catch {
      return c.json({ ok: false, error: "Value is not JSON-serializable" }, 400);
    }
    if (strValue.length > MAX_VALUE_BYTES) {
      return c.json({ ok: false, error: "Value too large" }, 400);
    }
    await repo.setSetting(c.env.DB, key, strValue);
    return c.json({ ok: true, data: { key, value: strValue } });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

export default app;
