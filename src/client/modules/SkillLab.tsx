import { useEffect, useState } from "react";
import type { Skill } from "@shared/types";
import { api } from "../lib/api";
import { Button, Card, ErrorText, Textarea } from "../components/ui";

export function SkillLab() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState("");

  useEffect(() => {
    let active = true;
    api
      .getSkills()
      .then((data) => {
        if (active) setSkills(data);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Failed");
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = skills.find((s) => s.id === selectedId) ?? null;

  const run = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const system = selected.instructions || selected.description || "You are a helpful assistant.";
      const data = await api.aiChat([
        { role: "system", content: system },
        { role: "user", content: input },
      ]);
      setOutput(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700" htmlFor="skill-select">
          Skill
        </label>
        <select
          id="skill-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Select a skill</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <Textarea label="Test input" value={input} onChange={(e) => setInput(e.target.value)} rows={6} />
      <Button onClick={run} loading={loading} disabled={!selected || !input.trim()}>
        Run
      </Button>
      <ErrorText message={error} />
      <Textarea label="Output" value={output} onChange={(e) => setOutput(e.target.value)} rows={10} />
    </Card>
  );
}
