import type { D1Database } from "@cloudflare/workers-types";
import { nowIso, newId } from "./utils";

export type AuthUser = {
  id: string;
  username: string;
  role: string;
};

const PBKDF2_ITERATIONS = 100_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = base64ToBytes(parts[2]);
  const expected = base64ToBytes(parts[3]);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    expected.length * 8,
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export async function ensureDefaultAdmin(db: D1Database): Promise<void> {
  const row = await db.prepare("SELECT COUNT(*) as c FROM users").first<{ c: number }>();
  if (row && row.c > 0) return;
  const now = nowIso();
  const id = newId();
  const hash = await hashPassword("admin123");
  await db
    .prepare(
      "INSERT INTO users (id,username,password_hash,role,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6)",
    )
    .bind(id, "admin", hash, "admin", now, now)
    .run();
}

export async function findUserByUsername(db: D1Database, username: string): Promise<{ id: string; username: string; password_hash: string; role: string } | null> {
  const row = await db
    .prepare("SELECT id,username,password_hash,role FROM users WHERE username = ?1")
    .bind(username)
    .first<{ id: string; username: string; password_hash: string; role: string }>();
  return row ?? null;
}

export async function createSession(db: D1Database, userId: string, ttlMs = 7 * 24 * 60 * 60 * 1000): Promise<string> {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToHex(tokenBytes);
  const now = Date.now();
  const expiresAt = new Date(now + ttlMs).toISOString();
  await db
    .prepare("INSERT INTO sessions (token,user_id,expires_at,created_at) VALUES (?1,?2,?3,?4)")
    .bind(token, userId, expiresAt, nowIso())
    .run();
  return token;
}

export async function getSessionUser(db: D1Database, token: string): Promise<AuthUser | null> {
  const row = await db
    .prepare(
      "SELECT u.id,u.username,u.role,s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?1",
    )
    .bind(token)
    .first<{ id: string; username: string; role: string; expires_at: string }>();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.prepare("DELETE FROM sessions WHERE token = ?1").bind(token).run();
    return null;
  }
  return { id: row.id, username: row.username, role: row.role };
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token = ?1").bind(token).run();
}

export async function changePassword(db: D1Database, userId: string, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  await db
    .prepare("UPDATE users SET password_hash = ?1, updated_at = ?2 WHERE id = ?3")
    .bind(hash, nowIso(), userId)
    .run();
}

export async function createUser(db: D1Database, username: string, password: string, role = "user"): Promise<AuthUser> {
  const now = nowIso();
  const id = newId();
  const hash = await hashPassword(password);
  await db
    .prepare("INSERT INTO users (id,username,password_hash,role,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6)")
    .bind(id, username, hash, role, now, now)
    .run();
  return { id, username, role };
}
