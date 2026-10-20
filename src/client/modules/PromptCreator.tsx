import { useState } from "react";
import { api } from "../lib/api";
import { Button, Card, ErrorText, Input, SuccessText, Textarea } from "../components/ui";
import { cn } from "../components/utils";

interface PromptContext {
  role?: string;
  variables?: string[];
  constraints?: string;
  examples?: string;
}

/** Split the comma-separated Variables input: trim entries, drop empties, cap at 50. */
function parseVariables(raw: string): string[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 50);
}

export function PromptCreator() {
  const [goal, setGoal] = useState("");
  const [role, setRole] = useState("");
  const [variables, setVariables] = useState("");
  const [constraints, setConstraints] = useState("");
  const [examples, setExamples] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [evalInfo, setEvalInfo] = useState<string | null>(null);

  // Empty optional fields must stay absent from the request body, never "".
  const buildContext = (): PromptContext => {
    const ctx: PromptContext = {};
    const parsedVariables = parseVariables(variables);
    if (role.trim()) ctx.role = role.trim();
    if (parsedVariables.length > 0) ctx.variables = parsedVariables;
    if (constraints.trim()) ctx.constraints = constraints.trim();
    if (examples.trim()) ctx.examples = examples.trim();
    return ctx;
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setEvalInfo(null);
    try {
      const data = await api.aiGeneratePrompt(goal, buildContext());
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
      const ctx = buildContext();
      await api.createPrompt({
        title: goal.trim().slice(0, 80) || "Generated prompt",
        content: result,
        role: ctx.role,
        variables: ctx.variables,
        constraints: ctx.constraints,
        examples: ctx.examples,
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

      <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
        <button
          type="button"
          aria-expanded={contextOpen}
          aria-controls="prompt-context-fields"
          onClick={() => setContextOpen((open) => !open)}
          className="inline-flex w-full items-center justify-between gap-3 rounded-lg text-left text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <span>
            Add context{" "}
            <span className="text-xs font-normal text-slate-500">(optional: role, variables, constraints, examples)</span>
          </span>
          <svg
            className={cn("h-4 w-4 text-slate-500 transition-transform", contextOpen ? "rotate-180" : "")}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div id="prompt-context-fields" hidden={!contextOpen} className="space-y-4 pt-4">
          <Input label="Role" value={role} onChange={(e) => setRole(e.target.value)} />
          <Input
            label="Variables (comma separated)"
            value={variables}
            onChange={(e) => setVariables(e.target.value)}
            hint="Comma-separated; entries are trimmed and blanks are dropped."
          />
          <Textarea label="Constraints" value={constraints} onChange={(e) => setConstraints(e.target.value)} rows={2} />
          <Textarea label="Examples" value={examples} onChange={(e) => setExamples(e.target.value)} rows={2} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={generate} loading={loading} disabled={!goal.trim()}>
          Generate
        </Button>
      </div>

      <ErrorText message={error} />
      <SuccessText message={success} />

      <div aria-live="polite" className="space-y-4">
        <Textarea label="Result" value={result} onChange={(e) => setResult(e.target.value)} rows={10} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} loading={loading} disabled={!result.trim()}>
            Save
          </Button>
          <Button
            onClick={evaluate}
            loading={loading}
            disabled={!result.trim()}
            className="bg-slate-600 hover:bg-slate-700"
          >
            Evaluate
          </Button>
          <Button
            onClick={optimize}
            loading={loading}
            disabled={!result.trim()}
            className="bg-slate-600 hover:bg-slate-700"
          >
            Optimize
          </Button>
        </div>
      </div>

      {evalInfo && (
        <div aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">Evaluation</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-800">{evalInfo}</pre>
        </div>
      )}
    </Card>
  );
}
