import { useState } from "react";
import { api } from "../lib/api";
import { Button, Card, ErrorText, Textarea } from "../components/ui";

export function PromptOptimizer() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState("");

  const optimize = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.aiOptimizePrompt(prompt);
      setResult(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-4">
      <Textarea label="Prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8} />
      <Button onClick={optimize} loading={loading} disabled={!prompt.trim()}>
        Optimize
      </Button>
      <ErrorText message={error} />
      <Textarea label="Improved prompt" value={result} onChange={(e) => setResult(e.target.value)} rows={10} />
    </Card>
  );
}
