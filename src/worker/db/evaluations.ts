import type { D1Database } from "@cloudflare/workers-types";
import type { Evaluation } from "@shared/types";
import { newId, nowIso } from "./utils";

type Row = {
  id: string;
  target_type: string;
  target_id: string;
  score: number | null;
  feedback: string | null;
  model: string | null;
  created_at: string;
};

function toEvaluation(row: Row): Evaluation {
  let feedback: unknown;
  if (row.feedback) {
    try {
      feedback = JSON.parse(row.feedback);
    } catch {
      feedback = row.feedback;
    }
  }
  return {
    id: row.id,
    targetType: row.target_type as "prompt" | "skill",
    targetId: row.target_id,
    score: row.score,
    feedback,
    model: row.model ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listEvaluations(db: D1Database, targetType?: string, targetId?: string): Promise<Evaluation[]> {
  let stmt = db.prepare("SELECT * FROM evaluations ORDER BY created_at DESC");
  if (targetType && targetId) {
    stmt = db.prepare("SELECT * FROM evaluations WHERE target_type=?1 AND target_id=?2 ORDER BY created_at DESC").bind(targetType, targetId);
  }
  const res = await stmt.all<Row>();
  return (res.results ?? []).map(toEvaluation);
}

export async function createEvaluation(
  db: D1Database,
  input: Omit<Evaluation, "id" | "createdAt">,
): Promise<Evaluation> {
  const id = newId();
  const now = nowIso();
  await db
    .prepare("INSERT INTO evaluations (id,target_type,target_id,score,feedback,model,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)")
    .bind(
      id,
      input.targetType,
      input.targetId,
      input.score ?? null,
      input.feedback !== undefined ? JSON.stringify(input.feedback) : null,
      input.model ?? null,
      now,
    )
    .run();
  const row = await db.prepare("SELECT * FROM evaluations WHERE id = ?1").bind(id).first<Row>();
  if (!row) throw new Error("Failed to create evaluation");
  return toEvaluation(row);
}
