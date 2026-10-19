import type { D1Database } from "@cloudflare/workers-types";
import { nowIso } from "./utils";

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?1").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  const now = nowIso();
  await db
    .prepare("INSERT INTO settings (key,value,updated_at) VALUES (?1,?2,?3) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at")
    .bind(key, value, now)
    .run();
}

export async function listSettings(db: D1Database): Promise<Record<string, string>> {
  const res = await db.prepare("SELECT key,value FROM settings").all<{ key: string; value: string }>();
  const out: Record<string, string> = {};
  for (const row of res.results ?? []) out[row.key] = row.value;
  return out;
}
export async function getSettingTyped<T>(db: D1Database, key: string): Promise<T | null> {
  const raw = await getSetting(db, key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

export async function setSettingTyped(db: D1Database, key: string, value: unknown): Promise<void> {
  await setSetting(db, key, JSON.stringify(value));
}
