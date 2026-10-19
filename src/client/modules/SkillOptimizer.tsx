import { useState } from "react";
import { api } from "../lib/api";
import { Button, Card, ErrorText, Textarea } from "../components/ui";

export function SkillOptimizer() {
  const [skill, setSkill] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState("");

  const optimize = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.aiOptimizeSkill(skill);
      setResult(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-5">
      <Textarea label="Skill" value={skill} onChange={(e) => setSkill(e.target.value)} rows={10} />
      <Button onClick={optimize} loading={loading} disabled={!skill.trim()}>
        Optimize
      </Button>
      <ErrorText message={error} />
      <div aria-live="polite">
        <Textarea label="Improved skill" value={result} onChange={(e) => setResult(e.target.value)} rows={12} />
      </div>
    </Card>
  );
}
