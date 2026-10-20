import { useState } from "react";
import { api } from "../lib/api";
import { Alert, Button, Card, ErrorText, Input, Textarea } from "../components/ui";
import type { SkillSearchResponse } from "@shared/types";

export function SkillResearch() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [data, setData] = useState<SkillSearchResponse | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setDegraded(false);
    try {
      // /api/ai/search-skills combines a best-effort web search with an AI
      // summary. When the web-search leg fails, `webSearchUnavailable` is
      // true and `results` is empty because of that — the response never
      // means "nothing matched", so we surface the degradation explicitly.
      const response = await api.aiSearchSkills(topic);
      setData(response);
      setDegraded(response.webSearchUnavailable);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-5">
      <Input label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
      <Button onClick={run} loading={loading} disabled={!topic.trim()}>
        Research
      </Button>
      <ErrorText message={error} />
      {degraded && (
        <Alert tone="warning" role="alert" title="Web search unavailable">
          Live web results could not be retrieved; the summary below is AI-only.
        </Alert>
      )}
      <div aria-live="polite" className="space-y-3">
        {data && <Textarea label="Response" value={data.content} onChange={() => {}} rows={12} readOnly />}
        {data?.results.map((r, idx) => (
          <Card key={`${r.url}-${idx}`} className="space-y-1">
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-indigo-600 hover:underline"
            >
              {r.title}
            </a>
            <p className="text-xs text-slate-500">{r.url}</p>
            <p className="text-sm text-slate-700">{r.snippet}</p>
          </Card>
        ))}
        {data && data.results.length === 0 && !degraded && (
          <p className="text-sm text-slate-500">No results.</p>
        )}
      </div>
    </Card>
  );
}
