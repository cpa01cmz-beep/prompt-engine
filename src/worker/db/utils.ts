export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 200;

/**
 * Clamp a client-supplied page size to a bounded range so list queries can
 * never return an unbounded result set.
 */
export function clampListLimit(raw?: string | null): number {
  const parsed = parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIST_LIMIT;
  return Math.min(parsed, MAX_LIST_LIMIT);
}

/**
 * Escape SQL LIKE wildcards so a search term matches literally. Use together
 * with `LIKE ? ESCAPE '\\'`.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Parse a stored JSON column that must be a JSON array of strings. Anything
 * else (corrupted or unexpected shapes) degrades to `undefined` instead of
 * letting non-string elements flow to clients.
 */
export function parseStringArray(value: string | null): string[] | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return undefined;
    const out: string[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") return undefined;
      out.push(item);
    }
    return out;
  } catch {
    return undefined;
  }
}
