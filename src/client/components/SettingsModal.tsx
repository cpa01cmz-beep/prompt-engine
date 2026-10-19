import { useEffect, useState } from "react";
import { Button, Card, Input, Textarea, Alert } from "./ui";
import { api } from "../lib/api";

const STORAGE_KEY = "ai.provider";

type ProviderProfile = {
  name: string;
  baseUrl: string;
  model: string;
  note?: string;
};

const PRESETS: ProviderProfile[] = [
  {
    name: "opencode.ai free (default)",
    baseUrl: "https://opencode.ai/zen/v1",
    model: "deepseek-v4.1-flash-free",
    note: "No API key required for the free tier.",
  },
  {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    note: "Requires OPENAI_API_KEY configured by the operator.",
  },
  {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    note: "Requires GROQ/OpenAI-compatible key configured by the operator.",
  },
];

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preset, setPreset] = useState(PRESETS[0].name);
  const [baseUrl, setBaseUrl] = useState(PRESETS[0].baseUrl);
  const [model, setModel] = useState(PRESETS[0].model);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(null);
    api
      .getSetting<{ baseUrl?: string; model?: string }>(STORAGE_KEY)
      .then((data) => {
        if (cancelled) return;
        if (data?.value?.baseUrl) setBaseUrl(data.value.baseUrl);
        if (data?.value?.model) setModel(data.value.model);
        const match = PRESETS.find((p) => p.baseUrl === data?.value?.baseUrl && p.model === data?.value?.model);
        if (match) setPreset(match.name);
      })
      .catch(() => {
        // 404 is expected on first run; keep defaults
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const selectedPreset = PRESETS.find((p) => p.name === preset);

  const applyPreset = (name: string) => {
    setPreset(name);
    const found = PRESETS.find((p) => p.name === name);
    if (found) {
      setBaseUrl(found.baseUrl);
      setModel(found.model);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.setSetting(STORAGE_KEY, { baseUrl: baseUrl.trim(), model: model.trim() });
      setSuccess("Settings saved. New AI requests will use the selected provider.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="settings-title" className="text-xl font-bold text-slate-900">Settings</h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose the AI provider and model. API keys are configured by the operator through environment variables.
            </p>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close settings">
            Close
          </Button>
        </div>

        {loading ? <p className="mt-4 text-sm text-slate-500">Loading settings…</p> : null}
        <Alert tone="info" className="mt-4">
          Secrets are never stored in the browser or database. The Worker reads provider credentials from environment variables.
        </Alert>

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="provider-preset">
            Provider preset
            <select
              id="provider-preset"
              value={preset}
              onChange={(e) => applyPreset(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
              <option value="Custom">Custom</option>
            </select>
          </label>

          {selectedPreset?.note ? <p className="text-xs text-slate-500">{selectedPreset.note}</p> : null}

          <Input
            label="Base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://opencode.ai/zen/v1"
            hint="Must be an OpenAI-compatible chat completions endpoint."
          />
          <Input
            label="Model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="deepseek-v4.1-flash-free"
          />

          {preset === "Custom" ? (
            <Textarea
              label="Notes"
              rows={3}
              placeholder="Optional notes about this provider configuration."
            />
          ) : null}

          <Alert tone={error ? "error" : success ? "success" : "info"}>
            {error || success || "Changes apply to future AI requests only."}
          </Alert>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !baseUrl.trim() || !model.trim()}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
