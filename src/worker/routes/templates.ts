import { Hono } from "hono";
import type { Env } from "../env";
import * as repo from "../db/templates";
import { TemplateInputSchema, TemplateUpdateSchema } from "../schemas";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  try {
    const search = c.req.query("q");
    const data = await repo.listTemplates(c.env.DB, search ?? undefined);
    return c.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const item = await repo.getTemplate(c.env.DB, c.req.param("id"));
    if (!item) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: item });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = TemplateInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const created = await repo.createTemplate(c.env.DB, parsed.data);
    return c.json({ ok: true, data: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.put("/:id", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = TemplateUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const updated = await repo.updateTemplate(c.env.DB, c.req.param("id"), parsed.data);
    if (!updated) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.delete("/:id", async (c) => {
  try {
    const ok = await repo.deleteTemplate(c.env.DB, c.req.param("id"));
    if (!ok) return c.json({ ok: false, error: "Not found" }, 404);
    return c.json({ ok: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

// Render template
app.post("/:id/render", async (c) => {
  try {
    const item = await repo.getTemplate(c.env.DB, c.req.param("id"));
    if (!item) return c.json({ ok: false, error: "Not found" }, 404);
    let variables: Record<string, unknown> = {};
    try {
      const body = await c.req.json();
      if (body && typeof body === "object" && body.variables && typeof body.variables === "object") {
        variables = body.variables as Record<string, unknown>;
      } else if (body && typeof body === "object") {
        variables = body as Record<string, unknown>;
      }
    } catch {
      // no body
    }
    // also accept query params
    for (const [k, v] of Object.entries(c.req.query())) {
      if (!(k in variables)) variables[k] = v;
    }
    let rendered = item.body;
    const missing: string[] = [];
    rendered = rendered.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
      if (Object.prototype.hasOwnProperty.call(variables, key)) {
        return String(variables[key]);
      }
      missing.push(key);
      return `{{${key}}}`;
    });
    return c.json({ ok: true, data: { rendered, missing } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

app.get("/:id/render", async (c) => {
  try {
    const item = await repo.getTemplate(c.env.DB, c.req.param("id"));
    if (!item) return c.json({ ok: false, error: "Not found" }, 404);
    const variables: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(c.req.query())) {
      variables[k] = v;
    }
    let rendered = item.body;
    const missing: string[] = [];
    rendered = rendered.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
      if (Object.prototype.hasOwnProperty.call(variables, key)) {
        return String(variables[key]);
      }
      missing.push(key);
      return `{{${key}}}`;
    });
    return c.json({ ok: true, data: { rendered, missing } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

export default app;
