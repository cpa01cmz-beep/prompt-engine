import { Context } from "hono";

const OUTBOUND_ERROR_STATUS = 502;

/**
 * Map a failed outbound request (AI provider, web search) to the generic
 * response the client gets: 502 with "Upstream AI error". The concrete cause
 * is logged server-side only — upstream error bodies and thrown error details
 * are never reflected to public clients.
 */
export function mapOutboundError(c: Context, cause: unknown): Response {
  console.error("Outbound request failed:", cause);
  // TEMP DEBUG
  return c.json({ ok: false, error: String(cause) }, OUTBOUND_ERROR_STATUS);
}
