import type { Env } from "../env";
import type { AiMessage } from "@shared/types";
import { listSettings } from "../db/settings";

export type AiConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export function getAiConfig(env: Env, settings?: Record<string, string>): AiConfig {
  const s = settings ?? {};
  const baseUrl =
    s.OPENAI_BASE_URL ||
    s.openai_base_url ||
    env.OPENAI_BASE_URL ||
    "https://opencode.ai/zen/v1";
  const model =
    s.OPENAI_MODEL ||
    s.openai_model ||
    env.OPENAI_MODEL ||
    "deepseek-v4-flash-free";
  const apiKey =
    s.OPENAI_API_KEY ||
    s.openai_api_key ||
    env.OPENAI_API_KEY;
  return { baseUrl, model, apiKey };
}

export async function resolveAiConfig(env: Env): Promise<AiConfig> {
  let settings: Record<string, string> = {};
  try {
    settings = await listSettings(env.DB);
  } catch {
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
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1200,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI request failed: ${res.status} ${text}`);
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
