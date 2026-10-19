import { useState } from "react";
import { api } from "../lib/api";
import { Button, Card, ErrorText, Textarea, Input, SuccessText } from "../components/ui";

export function PromptCreator() {
  const [goal, setGoal] = useState("");
  const [role, setRole] = useState("");
  const [variables, setVariables] = useState("");
  const [constraints, setConstraints] = useState("");
  const [examples, setExamples] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [evalInfo, setEvalInfo] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setEvalInfo(null);
    try {
      const data = await api.aiGeneratePrompt(goal);
      setResult(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const vars = variables
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      await api.createPrompt({
        title: goal.trim().slice(0, 80) || "Generated prompt",
        content: result,
        role: role || undefined,
        variables: vars.length ? vars : undefined,
        constraints: constraints || undefined,
        examples: examples || undefined,
      });
      setSuccess("Saved to library.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const evaluate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.aiEvaluatePrompt(result);
      setEvalInfo(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const optimize = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.aiOptimizePrompt(result);
      setResult(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-5">
      <Textarea label="Goal" value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} />
      <Input label="Role" value={role} onChange={(e) => setRole(e.target.value)} />
      <Input label="Variables (comma separated)" value={variables} onChange={(e) => setVariables(e.target.value)} />
      <Textarea label="Constraints" value={constraints} onChange={(e) => setConstraints(e.target.value)} rows={2} />
      <Textarea label="Examples" value={examples} onChange={(e) => setExamples(e.target.value)} rows={2} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={generate} loading={loading} disabled={!goal.trim()}>
          Generate
        </Button>
        <Button onClick={save} loading={loading} disabled={!result.trim()}>
          Save to Library
        </Button>
        <Button onClick={evaluate} loading={loading} disabled={!result.trim()} className="bg-slate-600 hover:bg-slate-700">
          Evaluate
        </Button>
        <Button onClick={optimize} loading={loading} disabled={!result.trim()} className="bg-slate-600 hover:bg-slate-700">
          Optimize
        </Button>
      </div>
      <ErrorText message={error} />
      <SuccessText message={success} />
      <div aria-live="polite">
        <Textarea label="Result" value={result} onChange={(e) => setResult(e.target.value)} rows={10} />
      </div>
      {evalInfo && (
        <Card className="bg-slate-50" aria-live="polite">
          <p className="text-sm font-medium text-slate-700">Evaluation</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-800">{evalInfo}</pre>
        </Card>
      )}
    </Card>
  );
}
