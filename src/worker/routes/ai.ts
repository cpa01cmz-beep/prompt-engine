import { Hono } from "hono";
import type { Env } from "../env";
import {
  chatCompletion,
  parseJsonFromText,
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
} from "../schemas";
import { fetchWithTimeout } from "../lib/fetchTimeout";
import { mapOutboundError } from "../lib/outboundError";

const SEARCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 512 * 1024;

/**
 * Parse the model's candidate-skills output via parseJsonFromText and validate
 * the shape with zod. Anything malformed becomes an empty list rather than raw
 * model text being surfaced as structured data.
 */
function parseSkillCandidates(content: string): Array<{ name: string; description?: string; url?: string }> {
  let parsed: unknown;
  try {
    parsed = parseJsonFromText(content);
  } catch {
    parsed = null;
  }
  const result = SkillCandidatesSchema.safeParse(parsed);
  return result.success ? result.data : [];
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
    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
    } catch {
      parsedJson = content;
    }
    return c.json({ ok: true, data: { content, evaluation: parsedJson } });
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
    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
    } catch {
      parsedJson = content;
    }
    return c.json({ ok: true, data: { content, skill: parsedJson } });
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
    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
    } catch {
      parsedJson = content;
    }
    return c.json({ ok: true, data: { content, evaluation: parsedJson } });
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
    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
    } catch {
      parsedJson = content;
    }
    return c.json({ ok: true, data: { content, skill: parsedJson } });
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
    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
    } catch {
      parsedJson = content;
    }
    return c.json({ ok: true, data: { content, comparison: parsedJson } });
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
      }
    } catch {
      // fallback to AI-only
    }
    const messages = buildSearchSkillsMessages(query, results);
    const content = await chatCompletion(c.env, messages, { temperature: 0.4 });
    const candidates = parseSkillCandidates(content);
    return c.json({ ok: true, data: { content, results, candidates } });
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

export default app;
