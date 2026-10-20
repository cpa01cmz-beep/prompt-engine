import { useEffect, useState } from "react";
import { Button, Card, Input, Alert } from "./ui";
import { api } from "../lib/api";

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
    note: "No API key required for the free tier (only inside OpenCode).",
  },
  {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    note: "Requires an OpenAI API key.",
  },
  {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    note: "Requires an OpenAI-compatible key.",
  },
  {
    name: "Custom",
    baseUrl: "",
    model: "",
    note: "Enter your own OpenAI-compatible endpoint.",
  },
];

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [preset, setPreset] = useState(PRESETS[0].name);
  const [baseUrl, setBaseUrl] = useState(PRESETS[0].baseUrl);
  const [model, setModel] = useState(PRESETS[0].model);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    api
      .getSettings()
      .then((data) => {
        const raw = data["ai.provider"];
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { baseUrl?: string; model?: string };
            if (parsed.baseUrl) setBaseUrl(parsed.baseUrl);
            if (parsed.model) setModel(parsed.model);
          } catch {
            // ignore
          }
        }
        if (data["OPENAI_API_KEY"]) setApiKey(data["OPENAI_API_KEY"]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load settings."))
      .finally(() => setLoading(false));
  }, [open]);

  const applyPreset = (name: string) => {
    setPreset(name);
    const p = PRESETS.find((x) => x.name === name);
    if (p && p.name !== "Custom") {
      setBaseUrl(p.baseUrl);
      setModel(p.model);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.setSetting("ai.provider", { baseUrl, model });
      if (apiKey.trim()) {
        await api.setSetting("OPENAI_API_KEY", apiKey.trim());
      }
      setSuccess("Saved. Changes apply to future AI requests.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setSuccess("Password changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <Card className="w-full max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">AI Provider Settings</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">Loading...</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Preset</label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={preset}
                onChange={(e) => applyPreset(e.target.value)}
              >
                {PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              {PRESETS.find((p) => p.name === preset)?.note && (
                <p className="mt-1 text-xs text-slate-500">
                  {PRESETS.find((p) => p.name === preset)?.note}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Base URL</label>
              <Input label="Base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Model</label>
              <Input label="Model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="model-name" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">API Key (stored securely server-side)</label>
              <Input label="API Key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
            </div>

            <Alert tone={error ? "error" : success ? "success" : "info"}>
              {error || success || "Changes apply to future AI requests only."}
            </Alert>

            <div className="flex justify-end gap-2">
              <Button variant="tertiary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>

            <hr className="my-2" />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Change password</h3>
<Input
                label="Current password"
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
<Input
                label="New password"
                type="password"
                placeholder="New password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button variant="secondary" onClick={changePassword} disabled={saving}>
                Change password
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
