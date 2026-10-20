import type { Env } from "../env";
import type { AiMessage } from "@shared/types";
import { listSettings } from "../db/settings";
import { parseAiProvider } from "./aiProvider";
import { fetchWithTimeout } from "../lib/fetchTimeout";

const DEFAULT_BASE_URL = "https://opencode.ai/zen/v1";
const DEFAULT_MODEL = "deepseek-v4.1-flash-free";
/** Generous default: self-hosted / free inference endpoints can be slow. */
const CHAT_TIMEOUT_MS = 120_000;

export type AiConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  apiKeyFromSettings?: boolean;
};

export function getAiConfig(env: Env, settings?: Record<string, string>): AiConfig {
  const e = (env ?? {}) as Env;
  const settingsApiKey = settings?.["OPENAI_API_KEY"];
  const apiKey = settingsApiKey || e.OPENAI_API_KEY;
  const apiKeyFromSettings = Boolean(settingsApiKey);
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
  options?: {
    temperature?: number;
    maxTokens?: number;
    /** Request JSON output at the provider level (OpenAI `response_format`). */
    jsonMode?: boolean;
  },
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
        max_tokens: options?.maxTokens ?? 8128,
        // Only sent when the caller opts in; providers that reject
        // response_format are handled by the retry in chatCompletionJSON.
        ...(options?.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
        stream: false,
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
  let content: string;
  try {
    content = await chatCompletion(env, messages, { ...options, jsonMode: true });
  } catch (err) {
    // Retry semantics: some OpenAI-compatible providers reject
    // `response_format` outright (HTTP 400). Retry once without it —
    // parseJsonFromText tolerates JSON wrapped in prose or fences.
    if (err instanceof Error && err.message.startsWith("AI request failed: 400")) {
      content = await chatCompletion(env, messages, options);
    } else {
      throw err;
    }
  }
  return parseJsonFromText(content) as T;
}

// Prompt builders

/** Optional prompt context that is appended as labeled sections after the goal. */
export type PromptGenerationContext = {
  role?: string;
  variables?: string[];
  constraints?: string;
  examples?: string;
};

/**
 * Compose the user message for prompt generation. Sections are appended in a
 * deterministic order only when provided and non-empty; a goal-only call (no
 * context, or an all-empty context) yields exactly the goal string alone.
 */
function composeGenerationUserMessage(goal: string, ctx?: PromptGenerationContext): string {
  const sections: string[] = [];
  if (ctx?.role) sections.push(`Role: ${ctx.role}`);
  if (ctx?.variables?.length) sections.push(`Variables: ${ctx.variables.join(", ")}`);
  if (ctx?.constraints) sections.push(`Constraints: ${ctx.constraints}`);
  if (ctx?.examples) sections.push(`Examples: ${ctx.examples}`);
  if (sections.length === 0) return goal;
  return `${goal}\n${sections.join("\n")}`;
}

export function buildCreatePromptMessages(
  goal: string,
  ctx?: PromptGenerationContext,
): AiMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are an expert prompt engineer. Write a production-quality, reusable prompt for the user's goal.",
        "Guidelines:",
        "- Output the prompt itself (ready to paste into a capable LLM), never an analysis or description of it.",
        "- Make the task, desired output format, tone, and quality bar explicit; eliminate ambiguity.",
        "- If variables are listed, embed each one in the prompt as a brace placeholder, e.g. {topic}. If a role is given, assign that role to the target model. Honor every constraint; learn structure from examples without copying their wording.",
        "- Keep the prompt self-contained: the target model gets no other context.",
        "Return only the prompt text — no preamble, no markdown fences, no commentary.",
      ].join("\n"),
    },
    { role: "user", content: composeGenerationUserMessage(goal, ctx) },
  ];
}

export function buildEvaluatePromptMessages(prompt: string): AiMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a strict, senior prompt reviewer. Evaluate the prompt supplied by the user.",
        "Rubric:",
        "- Clarity: one unambiguous task; no vague verbs.",
        "- Specificity: explicit output format, length, tone, audience, and success criteria.",
        "- Structure: role, context, and task are separated and logically ordered.",
        "- Variables: dynamic inputs are explicit brace placeholders, not buried in prose.",
        "- Robustness: behaves predictably when optional inputs are missing.",
        "Score 0-100: 90+ production-ready; 75-89 solid with minor gaps; 50-74 usable but needs rework; below 50 broken or contradictory.",
        'Return ONLY a JSON object, no prose and no markdown fences, exactly: {"score": <integer 0-100>, "feedback": ["<one actionable finding per string, most important first, max 8 items>"]}',
      ].join("\n"),
    },
    { role: "user", content: prompt },
  ];
}

export function buildOptimizePromptMessages(prompt: string): AiMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are an expert prompt engineer. Rewrite the user's prompt to maximize clarity, specificity, and reliability.",
        "Rules:",
        "- Preserve the author's intent and every {placeholder} exactly.",
        "- Make implicit requirements explicit; add output-format and edge-case guidance only where the prompt clearly lacks it.",
        "- Do not invent new tasks, and do not drop anything the original stated.",
        "Return only the improved prompt — no preamble, no markdown fences, no commentary.",
      ].join("\n"),
    },
    { role: "user", content: prompt },
  ];
}

export function buildComparePromptsMessages(promptA: string, promptB: string): AiMessage[] {
  return [
    {
      role: "system",
      content: [
        'You are a fair, strict judge in an "A vs B" prompt comparison.',
        "Judge both prompts with the same rubric: clarity, specificity, output control, and robustness to ambiguous input. Reward the prompt that will reliably produce the better result from a capable LLM — never length or style for its own sake.",
        'Return ONLY a JSON object, no prose and no markdown fences, exactly: {"winner": "A" or "B", "scores": {"A": <integer 0-100>, "B": <integer 0-100>}, "rationale": "<2-4 sentences grounded in rubric differences>"}',
      ].join("\n"),
    },
    { role: "user", content: `Prompt A:\n${promptA}\n\nPrompt B:\n${promptB}` },
  ];
}

export function buildCreateSkillMessages(goal: string): AiMessage[] {
  return [
    {
      role: "system",
      content: [
        "Create a skill definition for a capable AI agent from the user's goal.",
        'A skill is: "name" (short kebab-case identifier), "description" (one sentence: what it does and when to use it), "instructions" (step-by-step operating procedure an agent can follow verbatim), "tools" (array of tool names the skill needs; omit the key or use [] only when truly none are required).',
        "Rules: instructions must be imperative, ordered, and self-contained; each listed tool must be genuinely needed to complete the steps.",
        'Return ONLY a JSON object, no prose and no markdown fences, exactly: {"name": "...", "description": "...", "instructions": "...", "tools": ["..."]}',
      ].join("\n"),
    },
    { role: "user", content: goal },
  ];
}

export function buildEvaluateSkillMessages(skill: string): AiMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a strict, senior reviewer of agent skill definitions. Evaluate the skill supplied by the user.",
        "Rubric:",
        "- Purpose: description says what the skill does and when to use it.",
        "- Actionability: instructions are imperative, ordered, and executable by an agent without extra context.",
        "- Completeness: steps cover inputs, expected output, and failure handling.",
        "- Tool realism: every listed tool exists for the task; no missing or invented tools.",
        "Score 0-100: 90+ production-ready; 75-89 solid with minor gaps; 50-74 usable but needs rework; below 50 broken or contradictory.",
        'Return ONLY a JSON object, no prose and no markdown fences, exactly: {"score": <integer 0-100>, "feedback": ["<one actionable finding per string, most important first, max 8 items>"]}',
      ].join("\n"),
    },
    { role: "user", content: skill },
  ];
}

export function buildOptimizeSkillMessages(skill: string): AiMessage[] {
  return [
    {
      role: "system",
      content: [
        "Improve the skill definition supplied by the user.",
        "Rules: keep its purpose; rewrite instructions as imperative, ordered, self-contained steps; add failure handling only where clearly missing; keep only tools the steps genuinely require; keep every field's meaning stable (name stays a short kebab-case identifier, description stays one sentence).",
        'Return ONLY a JSON object, no prose and no markdown fences, exactly: {"name": "...", "description": "...", "instructions": "...", "tools": ["..."]}',
      ].join("\n"),
    },
    { role: "user", content: skill },
  ];
}

export function buildResearchMessages(topic: string, domain?: string): AiMessage[] {
  return [
    {
      role: "system",
      content: [
        "Research the given topic and produce a structured summary:",
        "1) A 2-3 sentence overview.",
        "2) Key points — at most 8 bullets, each one sentence.",
        "3) Notable trade-offs, caveats, or open questions.",
        "4) Sources, only if you actually have them; never fabricate citations.",
        "Be factual; state uncertainty explicitly instead of guessing.",
      ].join("\n"),
    },
    { role: "user", content: domain ? `Topic: ${topic}\nDomain: ${domain}` : topic },
  ];
}

export function buildSearchSkillsMessages(query: string, results: Array<{ title: string; url: string; snippet: string }>): AiMessage[] {
  return [
    {
      role: "system",
      content: [
        'From the supplied web search results, extract candidate reusable AI skills — an agent capability such as "summarize a PDF" or "write migration SQL".',
        "Rules: use only titles, descriptions, and URLs present in the results; never invent entries; skip pages that are not about an actionable capability; return [] when nothing qualifies.",
        'Return ONLY a JSON array, no prose and no markdown fences, exactly: [{"name": "...", "description": "...", "url": "..."}]',
      ].join("\n"),
    },
    { role: "user", content: `Query: ${query}\nResults:\n${JSON.stringify(results)}` },
  ];
}

export function buildRunSkillMessages(skill: unknown, input: unknown): AiMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are executing a skill. Follow its instructions exactly and apply them to the input.",
        "Rules: if the skill requires tools you lack or input fields that are missing, say precisely what is missing instead of improvising; return only the skill's result, not meta-commentary.",
      ].join("\n"),
    },
    { role: "user", content: `Skill:\n${JSON.stringify(skill)}\n\nInput:\n${typeof input === "string" ? input : JSON.stringify(input)}` },
  ];
}
