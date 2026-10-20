import { z } from "zod";
import { isPublicHttpsUrl } from "../lib/url";

const MAX_BASE_URL_LENGTH = 2048;
const MAX_MODEL_LENGTH = 200;

const AiProviderShapeSchema = z.object({
  baseUrl: z.string().trim().min(1).max(MAX_BASE_URL_LENGTH),
  model: z.string().trim().min(1).max(MAX_MODEL_LENGTH),
});

export type AiProviderSettingValue = { baseUrl: string; model: string };

/**
 * Validate the shape and URL constraints of a user-supplied `ai.provider`
 * setting value. Returns null for anything malformed or unsafe (non-https,
 * localhost, private/reserved IP literals, embedded credentials).
 */
export function parseAiProvider(value: unknown): AiProviderSettingValue | null {
  const parsed = AiProviderShapeSchema.safeParse(value);
  if (!parsed.success) return null;
  if (!isPublicHttpsUrl(parsed.data.baseUrl)) return null;
  return { baseUrl: parsed.data.baseUrl, model: parsed.data.model };
}
