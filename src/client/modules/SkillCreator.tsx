import { useState } from "react";
import { api } from "../lib/api";
import { Button, Card, ErrorText, SuccessText, Textarea } from "../components/ui";

export function SkillCreator() {
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await api.aiGenerateSkill(goal);
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
      await api.createSkill({
        name: goal.trim().slice(0, 80) || "Generated skill",
        description: "Generated skill",
        instructions: result,
      });
      setSuccess("Saved to library.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-4">
      <Textarea label="Goal" value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={generate} loading={loading} disabled={!goal.trim()}>
          Generate
        </Button>
        <Button onClick={save} loading={loading} disabled={!result.trim()}>
          Save to Library
        </Button>
      </div>
      <ErrorText message={error} />
      <SuccessText message={success} />
      <Textarea label="Result" value={result} onChange={(e) => setResult(e.target.value)} rows={12} />
    </Card>
  );
}
