import type { Env } from "../env";
import type { AiMessage } from "@shared/types";

export type AiConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export function getAiConfig(env: Env): AiConfig {
  return {
    baseUrl: env.OPENAI_BASE_URL || "https://opencode.ai/zen/v1",
    model: env.OPENAI_MODEL || "deepseek-v4-flash-free",
    apiKey: env.OPENAI_API_KEY,
  };
}

export async function chatCompletion(
  env: Env,
  messages: AiMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const cfg = getAiConfig(env);
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
