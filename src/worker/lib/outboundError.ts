import type { Context } from "hono";

const OUTBOUND_ERROR_STATUS = 502;
const OUTBOUND_ERROR_BODY = { ok: false, error: "Upstream AI error" } as const;

/**
 * Map a failed outbound request (AI provider, web search) to the generic
 * response the client gets: 502 with "Upstream AI error". The concrete cause
 * is logged server-side only — upstream error bodies and thrown error details
 * never reach the caller. Used by routes that fetch a remote upstream.
 */
export function mapOutboundError(c: Context, cause: unknown): Response {
  console.error("Outbound request failed:", cause);
  return c.json(OUTBOUND_ERROR_BODY, OUTBOUND_ERROR_STATUS);
}
