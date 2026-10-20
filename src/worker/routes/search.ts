import { Hono } from "hono";
import type { Env } from "../env";
import type { WebSearchResult } from "@shared/types";
import { isNonEmptyString } from "../lib/validate";
import { fetchWithTimeout } from "../lib/fetchTimeout";
import { mapOutboundError } from "../lib/outboundError";

const SEARCH_TIMEOUT_MS = 10_000;

type DuckTopic = {
  Text?: string;
  FirstURL?: string;
  Topics?: DuckTopic[];
};

type DuckResponse = {
  RelatedTopics?: DuckTopic[];
};

function collectResults(topics: DuckTopic[] | undefined): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  if (!Array.isArray(topics)) return results;
  for (const topic of topics) {
    if (topic && Array.isArray(topic.Topics)) {
      results.push(...collectResults(topic.Topics));
    } else if (topic && isNonEmptyString(topic.FirstURL) && isNonEmptyString(topic.Text)) {
      results.push({
        title: topic.Text,
        url: topic.FirstURL,
        snippet: topic.Text,
      });
    }
  }
  return results;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/web", async (c) => {
  try {
    const q = c.req.query("q");
    if (!isNonEmptyString(q)) {
      return c.json({ ok: false, error: "Missing required query parameter: q" }, 400);
    }
    if (q.length > 500) {
      return c.json({ ok: false, error: "Query too long (max 500 characters)" }, 400);
    }
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`;
    const res = await fetchWithTimeout(url, undefined, SEARCH_TIMEOUT_MS);
    if (!res.ok) {
      throw new Error(`DuckDuckGo request failed: ${res.status}`);
    }
    const json = (await res.json()) as DuckResponse;
    const results = collectResults(json.RelatedTopics);
    return c.json({ ok: true, data: { query: q, results } });
  } catch (err) {
    return mapOutboundError(c, err);
  }
});

export default app;
