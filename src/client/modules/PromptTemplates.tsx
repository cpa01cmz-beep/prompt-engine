import { useEffect, useState } from "react";
import type { Template } from "@shared/types";
import { api } from "../lib/api";
import { Button, Card, ErrorText, Input, SuccessText, Textarea } from "../components/ui";

function variablesOf(t: Template): string[] {
  if (t.variables && t.variables.length) return t.variables;
  const matches = t.body.match(/\{\{([^}]+)\}\}/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, "").trim())));
}

function instantiate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const k = key.trim();
    return values[k] ?? `{{${k}}}`;
  });
}

export function PromptTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [variables, setVariables] = useState("");

  const [selected, setSelected] = useState<Template | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const vars = variables
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const created = await api.createTemplate({
        name,
        body,
        variables: vars.length ? vars : undefined,
      });
      setTemplates((prev) => [created, ...prev]);
      setName("");
      setBody("");
      setVariables("");
      setSuccess("Template created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const select = (t: Template) => {
    setSelected(t);
    const vars = variablesOf(t);
    const init: Record<string, string> = {};
    vars.forEach((v) => {
      init[v] = "";
    });
    setValues(init);
  };

  const remove = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (selected?.id === id) setSelected(null);
      setSuccess("Deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const vars = selected ? variablesOf(selected) : [];

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button onClick={load} loading={loading}>
          Refresh
        </Button>
      </div>
      <ErrorText message={error} />
      <SuccessText message={success} />

      <Card className="space-y-4">
        <h3 className="font-semibold text-slate-900">Create template</h3>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea label="Body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
        <Input
          label="Variables (comma separated)"
          value={variables}
          onChange={(e) => setVariables(e.target.value)}
        />
        <Button onClick={create} loading={loading} disabled={!name.trim() || !body.trim()}>
          Create
        </Button>
      </Card>

      <div className="grid gap-4 md:grid-cols-2" aria-live="polite">
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id} className="space-y-2">
              <button type="button" onClick={() => select(t)} className="w-full text-left">
                <p className="font-semibold text-slate-900">{t.name}</p>
                <p className="line-clamp-2 text-sm text-slate-600">{t.body}</p>
              </button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => void remove(t.id)}
                disabled={loading}
              >
                Delete
              </Button>
            </Card>
          ))}
          {templates.length === 0 && !loading && (
            <p className="text-sm text-slate-500">No templates.</p>
          )}
        </div>
        <div>
          {selected ? (
            <Card className="space-y-4">
              <h3 className="font-semibold text-slate-900">{selected.name}</h3>
              {vars.map((v) => (
                <Input
                  key={v}
                  label={v}
                  value={values[v] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [v]: e.target.value }))
                  }
                />
              ))}
              <Card className="bg-slate-50">
                <p className="text-sm font-medium text-slate-700">Preview</p>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                  {instantiate(selected.body, values)}
                </pre>
              </Card>
            </Card>
          ) : (
            <p className="text-sm text-slate-500">Select a template to instantiate.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
