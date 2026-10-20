import { z } from "zod";
import { parseJsonFromText } from "../services/ai";

/**
 * Turn raw model output into validated, structured data.
 *
 * Model output is untrusted: it may be wrapped in markdown fences, surrounded
 * by prose, or malformed on hostile/broken upstream responses. This is the one
 * place where such text becomes structured data:
 *   1. the JSON is extracted (fences stripped) via `parseJsonFromText`,
 *   2. the result is validated against a zod schema (unknown keys stripped),
 *   3. on ANY failure the caller-provided safe fallback is returned.
 *
 * Raw model text is never surfaced as structured data, so a malformed response
 * can neither leak prose into typed fields nor crash a route handler.
 */
export function parseModelJson<T>(schema: z.ZodType<T>, text: string, fallback: T): T {
  let candidate: unknown;
  try {
    candidate = parseJsonFromText(text);
  } catch {
    return fallback;
  }
  const result = schema.safeParse(candidate);
  return result.success ? result.data : fallback;
}
