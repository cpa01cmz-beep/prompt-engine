export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function parseJsonBody<T>(c: { req: { json: () => Promise<unknown> } }): Promise<T> {
  const body = await c.req.json();
  return body as T;
}
