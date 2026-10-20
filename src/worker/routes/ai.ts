import { Hono } from "hono";
import type { Env } from "../env";
import {
  chatCompletion,
  buildCreatePromptMessages,
  buildEvaluatePromptMessages,
  buildOptimizePromptMessages,
  buildComparePromptsMessages,
  buildCreateSkillMessages,
  buildEvaluateSkillMessages,
  buildOptimizeSkillMessages,
  buildResearchMessages,
  buildSearchSkillsMessages,
  buildRunSkillMessages,
} from "../services/ai";
import type { AiMessage } from "@shared/types";
import {
  ChatRequestSchema,
  GeneratePromptSchema,
  EvaluatePromptSchema,
  OptimizePromptSchema,
  GenerateSkillSchema,
  EvaluateSkillSchema,
  OptimizeSkillSchema,
  SearchSkillsSchema,
  ResearchSchema,
  ComparePromptsSchema,
  RunSkillSchema,
  SkillCandidatesSchema,
  PromptEvaluationSchema,
  SkillDefinitionSchema,
  PromptComparisonSchema,
} from "../schemas";
import { fetchWithTimeout } from "../lib/fetchTimeout";
import { mapOutboundError } from "../lib/outboundError";
import * as auth from "../db/auth";
import { parseModelJson } from "../lib/modelJson";

const SEARCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 512 * 1024;

/**
 * Constants defining safe fallbacks for structured AI output: when the model's
 * JSON does not validate, the structured field degrades to `null` instead of
 * carrying raw, unvalidated model text. The unmodified `content` string is
 * still returned separately for display purposes.
 */
const PARSE_FALLBACK_NULL = null;

function parseSkillCandidates(content: string): Array<{ name: string; description?: string; url?: string }> {
  return parseModelJson(SkillCandidatesSchema, content, []);
}

const app = new Hono<{ Bindings: Env }>();

app.post("/chat", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const content = await chatCompletion(c.env, parsed.data.messages as AiMessage[]);
    return c.json({ ok: true, data: { content } });
  } catch (err) {
    return mapOutboundError(c, err);
  }
});

app.post("/generate-prompt", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = GeneratePromptSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const messages = buildCreatePromptMessages(parsed.data.goal);
    const content = await chatCompletion(c.env, messages, { temperature: 0.7 });
    return c.json({ ok: true, data: { content } });
  } catch (err) {
    return mapOutboundError(c, err);
  }
});

app.post("/evaluate-prompt", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = EvaluatePromptSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const messages = buildEvaluatePromptMessages(parsed.data.prompt);
    const content = await chatCompletion(c.env, messages, { temperature: 0.2 });
    // Zod-validated evaluation; malformed model output degrades to null
    // instead of returning raw unvalidated text as structured data.
    const evaluation = parseModelJson(PromptEvaluationSchema, content, PARSE_FALLBACK_NULL);
    return c.json({ ok: true, data: { content, evaluation } });
  } catch (err) {
    return mapOutboundError(c, err);
  }
});

app.post("/optimize-prompt", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = OptimizePromptSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const messages = buildOptimizePromptMessages(parsed.data.prompt);
    const content = await chatCompletion(c.env, messages, { temperature: 0.6 });
    return c.json({ ok: true, data: { content } });
  } catch (err) {
    return mapOutboundError(c, err);
  }
});

app.post("/generate-skill", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = GenerateSkillSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const messages = buildCreateSkillMessages(parsed.data.goal);
    const content = await chatCompletion(c.env, messages, { temperature: 0.7 });
    const skill = parseModelJson(SkillDefinitionSchema, content, PARSE_FALLBACK_NULL);
    return c.json({ ok: true, data: { content, skill } });
  } catch (err) {
    return mapOutboundError(c, err);
  }
});

app.post("/evaluate-skill", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = EvaluateSkillSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const messages = buildEvaluateSkillMessages(parsed.data.skill);
    const content = await chatCompletion(c.env, messages, { temperature: 0.2 });
    const evaluation = parseModelJson(PromptEvaluationSchema, content, PARSE_FALLBACK_NULL);
    return c.json({ ok: true, data: { content, evaluation } });
  } catch (err) {
    return mapOutboundError(c, err);
  }
});

app.post("/optimize-skill", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = OptimizeSkillSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const messages = buildOptimizeSkillMessages(parsed.data.skill);
    const content = await chatCompletion(c.env, messages, { temperature: 0.6 });
    const skill = parseModelJson(SkillDefinitionSchema, content, PARSE_FALLBACK_NULL);
    return c.json({ ok: true, data: { content, skill } });
  } catch (err) {
    return mapOutboundError(c, err);
  }
});

app.post("/compare-prompts", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ComparePromptsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const messages = buildComparePromptsMessages(parsed.data.promptA, parsed.data.promptB);
    const content = await chatCompletion(c.env, messages, { temperature: 0.3 });
    const comparison = parseModelJson(PromptComparisonSchema, content, PARSE_FALLBACK_NULL);
    return c.json({ ok: true, data: { content, comparison } });
  } catch (err) {
    return mapOutboundError(c, err);
  }
});

app.post("/research", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ResearchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const messages = buildResearchMessages(parsed.data.topic, parsed.data.domain);
    const content = await chatCompletion(c.env, messages, { temperature: 0.5 });
    return c.json({ ok: true, data: { content } });
  } catch (err) {
    return mapOutboundError(c, err);
  }
});

app.post("/search-skills", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SearchSkillsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const query = parsed.data.query;
    let results: Array<{ title: string; url: string; snippet: string }> = [];
    // Web search is best-effort: if DuckDuckGo is unreachable we still return
    // the AI-only answer, but the client must be able to distinguish "the
    // search came back empty" from "we could not search at all". Instead of
    // silently returning [], the response carries an explicit
    // `webSearchUnavailable` flag.
    let webSearchUnavailable = false;
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetchWithTimeout(
        url,
        { headers: { "User-Agent": "Mozilla/5.0" } },
        SEARCH_TIMEOUT_MS,
      );
      if (res.ok) {
        // Bound the response size before regex parsing so a huge or hostile
        // payload cannot blow past the Worker memory/CPU budget.
        const html = (await res.text()).slice(0, MAX_HTML_BYTES);
        results = parseDuckDuckGoHtml(html).slice(0, 8);
      } else {
        webSearchUnavailable = true;
      }
    } catch {
      // Fallback to AI-only, flagged as degraded.
      webSearchUnavailable = true;
    }
    const messages = buildSearchSkillsMessages(query, results);
    const content = await chatCompletion(c.env, messages, { temperature: 0.4 });
    const candidates = parseSkillCandidates(content);
    return c.json({ ok: true, data: { content, results, candidates, webSearchUnavailable } });
  } catch (err) {
    return mapOutboundError(c, err);
  }
});

app.post("/run-skill", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = RunSkillSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: parsed.error.message }, 400);
    }
    const messages = buildRunSkillMessages(parsed.data.skill, parsed.data.input);
    const content = await chatCompletion(c.env, messages, { temperature: 0.5 });
    return c.json({ ok: true, data: { content } });
  } catch (err) {
    return mapOutboundError(c, err);
  }
});

function parseDuckDuckGoHtml(html: string): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  // Simple regex-based extraction for top results
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = resultRegex.exec(html)) !== null && results.length < 8) {
    const rawUrl = match[1];
    const title = stripTags(match[2]).trim();
    const snippet = stripTags(match[3]).trim();
    const url = decodeDuckUrl(rawUrl);
    if (title && url) {
      results.push({ title, url, snippet });
    }
  }
  // Fallback: parse result links only
  if (results.length === 0) {
    const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = linkRegex.exec(html)) !== null && results.length < 8) {
      const url = decodeDuckUrl(match[1]);
      const title = stripTags(match[2]).trim();
      if (title && url) results.push({ title, url, snippet: "" });
    }
  }
  return results;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeDuckUrl(raw: string): string {
  try {
    // DuckDuckGo redirect links: //duckduckgo.com/l/?uddg=...
    const uddgMatch = raw.match(/uddg=([^&]+)/);
    if (uddgMatch) return decodeURIComponent(uddgMatch[1]);
    if (raw.startsWith("//")) return "https:" + raw;
    return raw;
  } catch {
    return raw;
  }
}



function bearerToken(c: { req: { header: (name: string) => string | undefined } }): string | null {
  const h = c.req.header("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

app.post("/models", async (c) => {
  try {
    const token = bearerToken(c);
    if (!token) return c.json({ ok: false, error: "Unauthorized" }, 401);
    const user = await auth.getSessionUser(c.env.DB, token);
    if (!user) return c.json({ ok: false, error: "Unauthorized" }, 401);

    const body = (await c.req.json().catch(() => ({}))) as { baseUrl?: string; apiKey?: string };
    const baseUrl = (body.baseUrl ?? "").trim();
    if (!baseUrl) return c.json({ ok: false, error: "baseUrl is required" }, 400);

    // reuse trusted env key if no key provided
    const apiKey = body.apiKey?.trim() || c.env.OPENAI_API_KEY || "";
    const url = `${baseUrl.replace(/\/+$/, "")}/models`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(url, { method: "GET", headers });
    if (!res.ok) {
      return c.json({ ok: false, error: `Upstream error ${res.status}` }, 502);
    }
    const json = (await res.json().catch(() => ({}))) as { data?: Array<{ id?: string }>; models?: string[] };
    let models: string[] = [];
    if (Array.isArray(json.data)) {
      models = json.data.map((m) => m.id).filter((x): x is string => typeof x === "string");
    } else if (Array.isArray(json.models)) {
      models = json.models.filter((x): x is string => typeof x === "string");
    }
    models = Array.from(new Set(models)).sort();
    return c.json({ ok: true, data: { models } });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});



function bearerToken2(c: { req: { header: (name: string) => string | undefined } }): string | null {
  const h = c.req.header("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

app.post("/test", async (c) => {
  try {
    const token = bearerToken2(c);
    if (!token) return c.json({ ok: false, error: "Unauthorized" }, 401);
    const user = await auth.getSessionUser(c.env.DB, token);
    if (!user) return c.json({ ok: false, error: "Unauthorized" }, 401);

    const body = (await c.req.json().catch(() => ({}))) as {
      baseUrl?: string;
      model?: string;
      apiKey?: string;
    };
    const baseUrl = (body.baseUrl ?? "").trim();
    const model = (body.model ?? "").trim();
    const apiKey = (body.apiKey ?? "").trim() || c.env.OPENAI_API_KEY || "";
    if (!baseUrl) return c.json({ ok: false, error: "baseUrl is required" }, 400);
    if (!model) return c.json({ ok: false, error: "model is required" }, 400);

    const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      return c.json({ ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` });
    }
    return c.json({ ok: true, data: { status: res.status } });
  } catch (err) {
    console.error("Request failed:", err);
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

export default app;
