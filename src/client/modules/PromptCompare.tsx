import { useState } from "react";
import { api } from "../lib/api";
import { Button, Card, ErrorText, Textarea } from "../components/ui";

function parseScore(text: string | null): string {
  if (!text) return "—";
  try {
    const parsed = JSON.parse(text) as { score?: unknown };
    if (parsed && typeof parsed.score !== "undefined") return String(parsed.score);
  } catch {
    // ignore
  }
  return "—";
}

function variableCount(text: string): number {
  const matches = text.match(/\{\{[^}]+\}\}/g);
  return matches ? matches.length : 0;
}

export function PromptCompare() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resA, setResA] = useState<string | null>(null);
  const [resB, setResB] = useState<string | null>(null);

  const compare = async () => {
    setLoading(true);
    setError(null);
    setResA(null);
    setResB(null);
    try {
      const [da, db] = await Promise.all([
        api.aiEvaluatePrompt(a),
        api.aiEvaluatePrompt(b),
      ]);
      setResA(da.content);
      setResB(db.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Textarea label="Prompt A" value={a} onChange={(e) => setA(e.target.value)} rows={8} />
        <Textarea label="Prompt B" value={b} onChange={(e) => setB(e.target.value)} rows={8} />
      </div>
      <Button onClick={compare} loading={loading} disabled={!a.trim() || !b.trim()}>
        Evaluate both
      </Button>
      <ErrorText message={error} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-slate-50 space-y-1">
          <p className="font-semibold text-slate-900">Prompt A</p>
          <p className="text-sm text-slate-700">Score: {parseScore(resA)}</p>
          <p className="text-sm text-slate-700">Length: {a.length} chars</p>
          <p className="text-sm text-slate-700">Variables: {variableCount(a)}</p>
          {resA && <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-800">{resA}</pre>}
        </Card>
        <Card className="bg-slate-50 space-y-1">
          <p className="font-semibold text-slate-900">Prompt B</p>
          <p className="text-sm text-slate-700">Score: {parseScore(resB)}</p>
          <p className="text-sm text-slate-700">Length: {b.length} chars</p>
          <p className="text-sm text-slate-700">Variables: {variableCount(b)}</p>
          {resB && <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-800">{resB}</pre>}
        </Card>
      </div>
    </Card>
  );
}
