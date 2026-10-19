import type { D1Database } from "@cloudflare/workers-types";
import type { Skill } from "@shared/types";
import { newId, nowIso } from "./utils";

type Row = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  tools: string | null;
  examples: string | null;
  tags: string | null;
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

function toSkill(row: Row): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    instructions: row.instructions ?? undefined,
    tools: parseArray(row.tools),
    examples: parseArray(row.examples),
    tags: parseArray(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSkills(db: D1Database, search?: string): Promise<Skill[]> {
  const stmt = search
    ? db.prepare("SELECT * FROM skills WHERE name LIKE ?1 OR description LIKE ?1 ORDER BY updated_at DESC").bind(`%${search}%`)
    : db.prepare("SELECT * FROM skills ORDER BY updated_at DESC");
  const res = await stmt.all<Row>();
  return (res.results ?? []).map(toSkill);
}

export async function getSkill(db: D1Database, id: string): Promise<Skill | null> {
  const row = await db.prepare("SELECT * FROM skills WHERE id = ?1").bind(id).first<Row>();
  return row ? toSkill(row) : null;
}

export async function createSkill(
  db: D1Database,
  input: Omit<Skill, "id" | "createdAt" | "updatedAt">,
): Promise<Skill> {
  const id = newId();
  const now = nowIso();
  await db
    .prepare(
      "INSERT INTO skills (id,name,description,instructions,tools,examples,tags,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
    )
    .bind(
      id,
      input.name,
      input.description ?? null,
      input.instructions ?? null,
      input.tools ? JSON.stringify(input.tools) : null,
      input.examples ? JSON.stringify(input.examples) : null,
      input.tags ? JSON.stringify(input.tags) : null,
      now,
      now,
    )
    .run();
  const created = await getSkill(db, id);
  if (!created) throw new Error("Failed to create skill");
  return created;
}

export async function updateSkill(db: D1Database, id: string, input: Partial<Skill>): Promise<Skill | null> {
  const existing = await getSkill(db, id);
  if (!existing) return null;
  const now = nowIso();
  const merged = { ...existing, ...input };
  await db
    .prepare(
      "UPDATE skills SET name=?1,description=?2,instructions=?3,tools=?4,examples=?5,tags=?6,updated_at=?7 WHERE id=?8",
    )
    .bind(
      merged.name,
      merged.description ?? null,
      merged.instructions ?? null,
      merged.tools ? JSON.stringify(merged.tools) : null,
      merged.examples ? JSON.stringify(merged.examples) : null,
      merged.tags ? JSON.stringify(merged.tags) : null,
      now,
      id,
    )
    .run();
  return getSkill(db, id);
}

export async function deleteSkill(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare("DELETE FROM skills WHERE id = ?1").bind(id).run();
  return (res.meta?.changes ?? 0) > 0;
}
