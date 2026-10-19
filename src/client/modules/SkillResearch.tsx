import { useState } from "react";
import { api } from "../lib/api";
import { Button, Card, ErrorText, Input, Textarea } from "../components/ui";

export function SkillResearch() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState("");

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.aiChat([
        {
          role: "system",
          content: "You are a skill design researcher. Provide concise research and recommendations.",
        },
        { role: "user", content: topic },
      ]);
      setResult(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-4">
      <Input label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
      <Button onClick={run} loading={loading} disabled={!topic.trim()}>
        Research
      </Button>
      <ErrorText message={error} />
      <Textarea label="Response" value={result} onChange={(e) => setResult(e.target.value)} rows={12} />
    </Card>
  );
}
