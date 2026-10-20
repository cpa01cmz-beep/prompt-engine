import type { Env } from "../env";
import type { AiMessage } from "@shared/types";
import { listSettings } from "../db/settings";
import { parseAiProvider } from "./aiProvider";
import { fetchWithTimeout } from "../lib/fetchTimeout";

const DEFAULT_BASE_URL = "https://opencode.ai/zen/v1";
const DEFAULT_MODEL = "deepseek-v4.1-flash-free";
const CHAT_TIMEOUT_MS = 30_000;

export type AiConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  apiKeyFromSettings?: boolean;
};

export function getAiConfig(env: Env, settings?: Record<string, string>): AiConfig {
  const e = (env ?? {}) as Env;
  const settingsApiKey = settings?.["OPENAI_API_KEY"];
  const apiKey = e.OPENAI_API_KEY || settingsApiKey;
  const apiKeyFromSettings = !e.OPENAI_API_KEY && Boolean(settingsApiKey);
  // Operators can point the app at their own inference endpoint via the
  // user-writable `ai.provider` setting. Anything else in settings (including
  // legacy OPENAI_BASE_URL/OPENAI_MODEL keys) is ignored: that key space is
  // public and must never configure the provider or carry secrets — the API
  // key only ever comes from trusted environment configuration.
  const raw = settings?.["ai.provider"];
  let provider: unknown;
  if (typeof raw === "string") {
    try {
      provider = JSON.parse(raw);
    } catch {
      provider = undefined;
    }
  }
  const parsed = parseAiProvider(provider, env);
  if (parsed) {
    return { baseUrl: parsed.baseUrl, model: parsed.model, apiKey, apiKeyFromSettings };
  }
  // Fall back to trusted environment configuration when the setting is
  // absent or fails validation.
  return {
    baseUrl: e.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    model: e.OPENAI_MODEL || DEFAULT_MODEL,
    apiKey,
    apiKeyFromSettings,
  };
}

/**
 * HTTP header-carrying outbound fetches must only talk to the operator's
 * configured inference origin. A settings-overridden base URL points at an
 * untrusted host, so secrets are stripped from those requests.
 */
export function isTrustedAiOrigin(baseUrl: string, env: Env): boolean {
  try {
    const url = new URL(baseUrl.replace(/\/+$/, ""));
    const trusted = new URL((env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""));
    return url.origin === trusted.origin;
  } catch {
    return false;
  }
}

export async function resolveAiConfig(env: Env): Promise<AiConfig> {
  let settings: Record<string, string> = {};
  try {
    settings = await listSettings(env.DB);
  } catch (err) {
    // A broken settings store silently masking itself as "no provider
    // settings" makes diagnosis impossible; log it and fall back to defaults.
    console.error("resolveAiConfig: failed to load settings", err);
    settings = {};
  }
  return getAiConfig(env, settings);
}

export async function chatCompletion(
  env: Env,
  messages: AiMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const cfg = await resolveAiConfig(env);
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Never attach configured credentials to a non-trusted (settings-overridden)
  // base URL — that would leak the operator's API key to an arbitrary host.
  if (cfg.apiKey && (cfg.apiKeyFromSettings || isTrustedAiOrigin(cfg.baseUrl, env))) {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  }
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1200,
      }),
    },
    CHAT_TIMEOUT_MS,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI request failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

export function parseJsonFromText(text: string): unknown {
  let cleaned = text.trim();
  // strip markdown fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // extract first JSON object/array
    const match = cleaned.match(/[{[][\s\S]*[}\]]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
    throw new Error("Failed to parse JSON from model output");
  }
}

export async function chatCompletionJSON<T = unknown>(
  env: Env,
  messages: AiMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<T> {
  const content = await chatCompletion(env, messages, options);
  return parseJsonFromText(content) as T;
}

// Prompt builders
export function buildCreatePromptMessages(goal: string): AiMessage[] {
  return [
    { role: "system", content: "You are an expert prompt engineer. Generate a high-quality prompt for the user's goal. Return only the prompt text." },
    { role: "user", content: goal },
  ];
}

export function buildEvaluatePromptMessages(prompt: string): AiMessage[] {
  return [
    { role: "system", content: "Evaluate the prompt quality. Return JSON with score (0-100) and feedback array." },
    { role: "user", content: prompt },
  ];
}

export function buildOptimizePromptMessages(prompt: string): AiMessage[] {
  return [
    { role: "system", content: "Rewrite the prompt to improve clarity, specificity, and effectiveness. Return only the improved prompt." },
    { role: "user", content: prompt },
  ];
}

export function buildComparePromptsMessages(promptA: string, promptB: string): AiMessage[] {
  return [
    { role: "system", content: "Compare two prompts. Return JSON with winner (A or B), scores, and rationale." },
    { role: "user", content: `Prompt A:\n${promptA}\n\nPrompt B:\n${promptB}` },
  ];
}

export function buildCreateSkillMessages(goal: string): AiMessage[] {
  return [
    { role: "system", content: "Create a skill definition (name, description, instructions, tools). Return JSON." },
    { role: "user", content: goal },
  ];
}

export function buildEvaluateSkillMessages(skill: string): AiMessage[] {
  return [
    { role: "system", content: "Evaluate the skill definition. Return JSON with score (0-100) and feedback array." },
    { role: "user", content: skill },
  ];
}

export function buildOptimizeSkillMessages(skill: string): AiMessage[] {
  return [
    { role: "system", content: "Improve the skill definition. Return JSON with optimized fields." },
    { role: "user", content: skill },
  ];
}

export function buildResearchMessages(topic: string, domain?: string): AiMessage[] {
  return [
    { role: "system", content: "Research the topic and provide a structured summary with key points and sources." },
    { role: "user", content: domain ? `Topic: ${topic}\nDomain: ${domain}` : topic },
  ];
}

export function buildSearchSkillsMessages(query: string, results: Array<{ title: string; url: string; snippet: string }>): AiMessage[] {
  return [
    { role: "system", content: "From the web search results, extract candidate skills. Return JSON array of {name, description, url}." },
    { role: "user", content: `Query: ${query}\nResults:\n${JSON.stringify(results)}` },
  ];
}

export function buildRunSkillMessages(skill: unknown, input: unknown): AiMessage[] {
  return [
    { role: "system", content: "You are executing a skill. Follow its instructions to process the input and return the result." },
    { role: "user", content: `Skill:\n${JSON.stringify(skill)}\n\nInput:\n${typeof input === "string" ? input : JSON.stringify(input)}` },
  ];
}
