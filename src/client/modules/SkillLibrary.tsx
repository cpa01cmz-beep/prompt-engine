import { useEffect, useState } from "react";
import type { Skill } from "@shared/types";
import { api } from "../lib/api";
import { Button, Card, ErrorText, Input, SuccessText, Textarea } from "../components/ui";

export function SkillLibrary() {
  const [items, setItems] = useState<Skill[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<Skill | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editInstructions, setEditInstructions] = useState("");

  const load = async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSkills(q);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const select = (s: Skill) => {
    setSelected(s);
    setEditName(s.name);
    setEditDescription(s.description ?? "");
    setEditInstructions(s.instructions ?? "");
    setSuccess(null);
    setError(null);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.updateSkill(selected.id, {
        name: editName,
        description: editDescription,
        instructions: editInstructions,
      });
      setSelected(updated);
      setItems((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setSuccess("Updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.deleteSkill(id);
      setItems((prev) => prev.filter((s) => s.id !== id));
      if (selected?.id === id) setSelected(null);
      setSuccess("Deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button onClick={() => void load(query)} loading={loading}>
          Search
        </Button>
      </div>
      <ErrorText message={error} />
      <SuccessText message={success} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          {items.map((s) => (
            <Card key={s.id}>
              <button type="button" onClick={() => select(s)} className="w-full text-left">
                <p className="font-semibold text-slate-900">{s.name}</p>
                <p className="line-clamp-2 text-sm text-slate-600">{s.description ?? s.instructions}</p>
              </button>
              <div className="mt-2">
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => void remove(s.id)}
                  disabled={loading}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
          {items.length === 0 && !loading && (
            <p className="text-sm text-slate-500">No skills found.</p>
          )}
        </div>
        <div>
          {selected ? (
            <Card className="space-y-3">
              <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <Input
                label="Description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
              <Textarea
                label="Instructions"
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                rows={10}
              />
              <Button onClick={saveEdit} loading={loading}>
                Save changes
              </Button>
            </Card>
          ) : (
            <p className="text-sm text-slate-500">Select a skill to edit.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
