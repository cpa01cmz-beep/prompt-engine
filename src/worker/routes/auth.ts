import { Hono } from "hono";
import type { Env } from "../env";
import * as auth from "../db/auth";
import { z } from "zod";

const app = new Hono<{ Bindings: Env }>();

const LoginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(6).max(256),
});

const CreateUserSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(6).max(256),
  role: z.enum(["admin", "user"]).optional(),
});

function bearerToken(c: { req: { header: (name: string) => string | undefined } }): string | null {
  const h = c.req.header("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

app.post("/login", async (c) => {
  try {
    await auth.ensureDefaultAdmin(c.env.DB);
    const parsed = LoginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ ok: false, error: "Invalid credentials" }, 400);
    }
    const user = await auth.findUserByUsername(c.env.DB, parsed.data.username);
    if (!user) {
      return c.json({ ok: false, error: "Invalid credentials" }, 401);
    }
    const ok = await auth.verifyPassword(parsed.data.password, user.password_hash);
    if (!ok) {
      return c.json({ ok: false, error: "Invalid credentials" }, 401);
    }
    const token = await auth.createSession(c.env.DB, user.id);
    return c.json({ ok: true, data: { token, user: { id: user.id, username: user.username, role: user.role } } });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

app.get("/me", async (c) => {
  try {
    await auth.ensureDefaultAdmin(c.env.DB);
    const token = bearerToken(c);
    if (!token) return c.json({ ok: false, error: "Unauthorized" }, 401);
    const user = await auth.getSessionUser(c.env.DB, token);
    if (!user) return c.json({ ok: false, error: "Unauthorized" }, 401);
    return c.json({ ok: true, data: user });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

app.post("/logout", async (c) => {
  try {
    const token = bearerToken(c);
    if (token) await auth.deleteSession(c.env.DB, token);
    return c.json({ ok: true, data: { ok: true } });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

app.post("/change-password", async (c) => {
  try {
    const token = bearerToken(c);
    if (!token) return c.json({ ok: false, error: "Unauthorized" }, 401);
    const user = await auth.getSessionUser(c.env.DB, token);
    if (!user) return c.json({ ok: false, error: "Unauthorized" }, 401);
    const parsed = ChangePasswordSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
    }
    // verify current password
    const full = await auth.findUserByUsername(c.env.DB, user.username);
    if (!full) return c.json({ ok: false, error: "Unauthorized" }, 401);
    const ok = await auth.verifyPassword(parsed.data.currentPassword, full.password_hash);
    if (!ok) return c.json({ ok: false, error: "Current password is incorrect" }, 400);
    await auth.changePassword(c.env.DB, user.id, parsed.data.newPassword);
    return c.json({ ok: true, data: { ok: true } });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

app.post("/users", async (c) => {
  try {
    const token = bearerToken(c);
    if (!token) return c.json({ ok: false, error: "Unauthorized" }, 401);
    const user = await auth.getSessionUser(c.env.DB, token);
    if (!user || user.role !== "admin") return c.json({ ok: false, error: "Forbidden" }, 403);
    const parsed = CreateUserSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
    }
    const created = await auth.createUser(c.env.DB, parsed.data.username, parsed.data.password, parsed.data.role ?? "user");
    return c.json({ ok: true, data: created }, 201);
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});

export default app;
