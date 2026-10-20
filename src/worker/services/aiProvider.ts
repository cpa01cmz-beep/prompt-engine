import { z } from "zod";
import { isPublicHttpsUrl } from "../lib/url";

const MAX_BASE_URL_LENGTH = 2048;
const MAX_MODEL_LENGTH = 200;

const AiProviderShapeSchema = z.object({
  baseUrl: z.string().trim().min(1).max(MAX_BASE_URL_LENGTH),
  model: z.string().trim().min(1).max(MAX_MODEL_LENGTH),
});

export type AiProviderSettingValue = { baseUrl: string; model: string };

/** Normalize to a comparable origin (`https://host`), or null when invalid. Accepts bare hostnames. */
function httpsOrigin(url: string): string | null {
  try {
    const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
    if (!isPublicHttpsUrl(normalized)) return null;
    const u = new URL(normalized);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** Public `https://` origins the operator explicitly opted into. */
export function trustedProviderOrigins(env?: { OPENAI_BASE_URL?: string; AI_PROVIDER_ALLOWLIST?: string }): Set<string> {
  const origins = new Set<string>();
  const envOrigin = env?.OPENAI_BASE_URL ? httpsOrigin(env.OPENAI_BASE_URL) : null;
  if (envOrigin) origins.add(envOrigin);
  if (env?.AI_PROVIDER_ALLOWLIST) {
    for (const entry of env.AI_PROVIDER_ALLOWLIST.split(",")) {
      const origin = httpsOrigin(entry.trim());
      if (origin) origins.add(origin);
    }
  }
  return origins;
}

/**
 * Validate the shape and URL constraints of a user-supplied `ai.provider`
 * setting value. Returns null for anything malformed or unsafe (non-https,
 * localhost, private/reserved IP literals, embedded credentials) or when the
 * target origin is not trusted by the operator (no OPENAI_BASE_URL /
 * AI_PROVIDER_ALLOWLIST match) — this closes the SSRF/secret-exfiltration path.
 */
export function parseAiProvider(value: unknown, env?: { OPENAI_BASE_URL?: string; AI_PROVIDER_ALLOWLIST?: string }): AiProviderSettingValue | null {
  const parsed = AiProviderShapeSchema.safeParse(value);
  if (!parsed.success) return null;
  if (!isPublicHttpsUrl(parsed.data.baseUrl)) return null;
  const target = httpsOrigin(parsed.data.baseUrl);
  if (!target || !trustedProviderOrigins(env).has(target)) return null;
  return { baseUrl: parsed.data.baseUrl, model: parsed.data.model };
}
