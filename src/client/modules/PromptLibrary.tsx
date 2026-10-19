import { useEffect, useState } from "react";
import type { Prompt } from "@shared/types";
import { api } from "../lib/api";
import { Button, Card, ErrorText, Input, SuccessText, Textarea } from "../components/ui";

export function PromptLibrary() {
  const [items, setItems] = useState<Prompt[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<Prompt | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const load = async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPrompts(q);
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

  const select = (p: Prompt) => {
    setSelected(p);
    setEditTitle(p.title);
    setEditContent(p.content);
    setSuccess(null);
    setError(null);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.updatePrompt(selected.id, {
        title: editTitle,
        content: editContent,
      });
      setSelected(updated);
      setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
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
      await api.deletePrompt(id);
      setItems((prev) => prev.filter((p) => p.id !== id));
      if (selected?.id === id) {
        setSelected(null);
      }
      setSuccess("Deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Input label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button onClick={() => void load(query)} loading={loading}>
          Search
        </Button>
      </div>
      <ErrorText message={error} />
      <SuccessText message={success} />
      <div className="grid gap-4 md:grid-cols-2" aria-live="polite">
        <div className="space-y-2">
          {items.map((p) => (
            <Card key={p.id} className="cursor-pointer hover:bg-slate-50" >
              <button
                type="button"
                onClick={() => select(p)}
                className="w-full text-left"
              >
                <p className="font-semibold text-slate-900">{p.title}</p>
                <p className="line-clamp-2 text-sm text-slate-600">{p.content}</p>
              </button>
              <div className="mt-2 flex gap-2">
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => void remove(p.id)}
                  disabled={loading}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
          {items.length === 0 && !loading && (
            <p className="text-sm text-slate-500">No prompts found.</p>
          )}
        </div>
        <div>
          {selected ? (
            <Card className="space-y-4">
              <Input label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              <Textarea label="Content" value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={10} />
              <Button onClick={saveEdit} loading={loading}>
                Save changes
              </Button>
            </Card>
          ) : (
            <p className="text-sm text-slate-500">Select a prompt to edit.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
