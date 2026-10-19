import { useState } from "react";
import type { WebSearchResult } from "@shared/types";
import { api } from "../lib/api";
import { Button, Card, ErrorText, Input } from "../components/ui";

export function SkillSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<WebSearchResult[]>([]);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const data = await api.searchWeb(query);
      setResults(data.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex-1">
          <Input label="Query" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="self-end">
          <Button onClick={run} loading={loading} disabled={!query.trim()}>
            Search
          </Button>
        </div>
      </div>
      <ErrorText message={error} />
      <div className="space-y-3">
        {results.map((r, idx) => (
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
        {results.length === 0 && !loading && !error && (
          <p className="text-sm text-slate-500">No results.</p>
        )}
      </div>
    </Card>
  );
}
