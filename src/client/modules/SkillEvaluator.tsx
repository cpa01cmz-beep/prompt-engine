import { useState } from "react";
import { api } from "../lib/api";
import { Button, Card, ErrorText, Textarea } from "../components/ui";

function parseMaybeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function SkillEvaluator() {
  const [skill, setSkill] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const evaluate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.aiEvaluateSkill(skill);
      setResult(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const parsed = result ? parseMaybeJson(result) : null;
  const score =
    parsed && typeof parsed === "object" && parsed !== null && "score" in parsed
      ? (parsed as { score?: unknown }).score
      : null;
  const feedback =
    parsed && typeof parsed === "object" && parsed !== null && "feedback" in parsed
      ? (parsed as { feedback?: unknown }).feedback
      : null;

  return (
    <Card className="space-y-5">
      <Textarea label="Skill" value={skill} onChange={(e) => setSkill(e.target.value)} rows={10} />
      <Button onClick={evaluate} loading={loading} disabled={!skill.trim()}>
        Evaluate
      </Button>
      <ErrorText message={error} />
      {result && (
        <Card className="bg-slate-50 space-y-2" aria-live="polite">
          {score !== null && score !== undefined && (
            <p className="text-lg font-semibold text-slate-900">Score: {String(score)}</p>
          )}
          {feedback !== null && feedback !== undefined && (
            <pre className="whitespace-pre-wrap text-sm text-slate-800">
              {typeof feedback === "string" ? feedback : JSON.stringify(feedback, null, 2)}
            </pre>
          )}
          {score === null && <pre className="whitespace-pre-wrap text-sm text-slate-800">{result}</pre>}
        </Card>
      )}
    </Card>
  );
}
