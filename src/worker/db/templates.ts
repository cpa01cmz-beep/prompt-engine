import type { D1Database } from "@cloudflare/workers-types";
import type { Template } from "@shared/types";
import { newId, nowIso } from "./utils";

type Row = {
  id: string;
  name: string;
  body: string;
  variables: string | null;
  created_at: string;
  updated_at: string;
};

function parseArray(v: string | null): string[] | undefined {
  if (!v) return undefined;
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? (p as string[]) : undefined;
  } catch {
    return undefined;
  }
}

function toTemplate(row: Row): Template {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    variables: parseArray(row.variables),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTemplates(db: D1Database, search?: string): Promise<Template[]> {
  const stmt = search
    ? db.prepare("SELECT * FROM templates WHERE name LIKE ?1 OR body LIKE ?1 ORDER BY updated_at DESC").bind(`%${search}%`)
    : db.prepare("SELECT * FROM templates ORDER BY updated_at DESC");
  const res = await stmt.all<Row>();
  return (res.results ?? []).map(toTemplate);
}

export async function getTemplate(db: D1Database, id: string): Promise<Template | null> {
  const row = await db.prepare("SELECT * FROM templates WHERE id = ?1").bind(id).first<Row>();
  return row ? toTemplate(row) : null;
}

export async function createTemplate(
  db: D1Database,
  input: Omit<Template, "id" | "createdAt" | "updatedAt">,
): Promise<Template> {
  const id = newId();
  const now = nowIso();
  await db
    .prepare("INSERT INTO templates (id,name,body,variables,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6)")
    .bind(id, input.name, input.body, input.variables ? JSON.stringify(input.variables) : null, now, now)
    .run();
  const created = await getTemplate(db, id);
  if (!created) throw new Error("Failed to create template");
  return created;
}

export async function updateTemplate(db: D1Database, id: string, input: Partial<Template>): Promise<Template | null> {
  const existing = await getTemplate(db, id);
  if (!existing) return null;
  const now = nowIso();
  const merged = { ...existing, ...input };
  await db
    .prepare("UPDATE templates SET name=?1,body=?2,variables=?3,updated_at=?4 WHERE id=?5")
    .bind(merged.name, merged.body, merged.variables ? JSON.stringify(merged.variables) : null, now, id)
    .run();
  return getTemplate(db, id);
}

export async function deleteTemplate(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare("DELETE FROM templates WHERE id = ?1").bind(id).run();
  return (res.meta?.changes ?? 0) > 0;
}
