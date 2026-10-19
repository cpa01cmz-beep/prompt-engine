import type { D1Database } from "@cloudflare/workers-types";
import type { Prompt } from "@shared/types";
import { newId, nowIso } from "./utils";

type PromptRow = {
  id: string;
  title: string;
  content: string;
  role: string | null;
  variables: string | null;
  constraints: string | null;
  examples: string | null;
  tags: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

function parseArray(value: string | null): string[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : undefined;
  } catch {
    return undefined;
  }
}

function rowToPrompt(row: PromptRow): Prompt {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    role: row.role ?? undefined,
    variables: parseArray(row.variables),
    constraints: row.constraints ?? undefined,
    examples: row.examples ?? undefined,
    tags: parseArray(row.tags),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPrompts(db: D1Database, search?: string): Promise<Prompt[]> {
  const stmt = search
    ? db.prepare("SELECT * FROM prompts WHERE title LIKE ?1 OR content LIKE ?1 ORDER BY updated_at DESC").bind(`%${search}%`)
    : db.prepare("SELECT * FROM prompts ORDER BY updated_at DESC");
  const res = await stmt.all<PromptRow>();
  return (res.results ?? []).map(rowToPrompt);
}

export async function getPrompt(db: D1Database, id: string): Promise<Prompt | null> {
  const row = await db.prepare("SELECT * FROM prompts WHERE id = ?1").bind(id).first<PromptRow>();
  return row ? rowToPrompt(row) : null;
}

export async function createPrompt(
  db: D1Database,
  input: Omit<Prompt, "id" | "version" | "createdAt" | "updatedAt">,
): Promise<Prompt> {
  const id = newId();
  const now = nowIso();
  await db
    .prepare(
      "INSERT INTO prompts (id,title,content,role,variables,constraints,examples,tags,version,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
    )
    .bind(
      id,
      input.title,
      input.content,
      input.role ?? null,
      input.variables ? JSON.stringify(input.variables) : null,
      input.constraints ?? null,
      input.examples ?? null,
      input.tags ? JSON.stringify(input.tags) : null,
      1,
      now,
      now,
    )
    .run();
  const created = await getPrompt(db, id);
  if (!created) throw new Error("Failed to create prompt");
  return created;
}

export async function updatePrompt(db: D1Database, id: string, input: Partial<Prompt>): Promise<Prompt | null> {
  const existing = await getPrompt(db, id);
  if (!existing) return null;
  const now = nowIso();
  const merged = { ...existing, ...input };
  await db
    .prepare(
      "UPDATE prompts SET title=?1,content=?2,role=?3,variables=?4,constraints=?5,examples=?6,tags=?7,version=?8,updated_at=?9 WHERE id=?10",
    )
    .bind(
      merged.title,
      merged.content,
      merged.role ?? null,
      merged.variables ? JSON.stringify(merged.variables) : null,
      merged.constraints ?? null,
      merged.examples ?? null,
      merged.tags ? JSON.stringify(merged.tags) : null,
      (existing.version ?? 1) + 1,
      now,
      id,
    )
    .run();
  return getPrompt(db, id);
}

export async function deletePrompt(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare("DELETE FROM prompts WHERE id = ?1").bind(id).run();
  return (res.meta?.changes ?? 0) > 0;
}
