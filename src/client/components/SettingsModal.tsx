import { useEffect, useState } from "react";
import { Button, Card, Input, Alert } from "./ui";
import { api } from "../lib/api";

type ProviderProfile = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
};

const newProvider = (): ProviderProfile => ({
  id: crypto.randomUUID(),
  name: "New provider",
  baseUrl: "",
  model: "",
  apiKey: "",
});

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const active = providers.find((p) => p.id === activeId) ?? null;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    api
      .getSettings()
      .then((data) => {
        let list: ProviderProfile[] = [];
        if (data["ai.providers"]) {
          try {
            const parsed = JSON.parse(data["ai.providers"]);
            if (Array.isArray(parsed)) {
              list = parsed.map((p) => {
                const q = (p ?? {}) as { id?: string; name?: string; baseUrl?: string; model?: string; apiKey?: string };
                return {
                  id: q.id || crypto.randomUUID(),
                  name: q.name || "Provider",
                  baseUrl: q.baseUrl || "",
                  model: q.model || "",
                  apiKey: q.apiKey || data["OPENAI_API_KEY"] || "",
                };
              });
            }
          } catch {
            list = [];
          }
        }
        if (list.length === 0) {
          // migrate from legacy single provider
          let baseUrl = "";
          let model = "";
          if (data["ai.provider"]) {
            try {
              const parsed = JSON.parse(data["ai.provider"]);
              baseUrl = parsed.baseUrl || "";
              model = parsed.model || "";
            } catch {
              // ignore
            }
          }
          list = [
            {
              id: crypto.randomUUID(),
              name: "Default",
              baseUrl,
              model,
              apiKey: data["OPENAI_API_KEY"] || "",
            },
          ];
        }
        setProviders(list);
        setActiveId(list[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load settings."))
      .finally(() => setLoading(false));
  }, [open]);

  const updateActive = (patch: Partial<ProviderProfile>) => {
    if (!activeId) return;
    setProviders((prev) => prev.map((p) => (p.id === activeId ? { ...p, ...patch } : p)));
  };

  const addProvider = () => {
    const p = newProvider();
    setProviders((prev) => [...prev, p]);
    setActiveId(p.id);
    setModels([]);
  };

  const deleteProvider = (id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id));
    if (activeId === id) {
      setActiveId(providers.find((p) => p.id !== id)?.id ?? null);
    }
  };

  const fetchModels = async () => {
    if (!active) return;
    setLoadingModels(true);
    setError(null);
    try {
      const res = await api.aiFetchModels(active.baseUrl, active.apiKey);
      setModels(res.models);
      if (res.models.length > 0 && !res.models.includes(active.model)) {
        updateActive({ model: res.models[0] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch models.");
    } finally {
      setLoadingModels(false);
    }
  };

  const save = async () => {
    if (!active) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.setSetting("ai.providers", providers);
      await api.setSetting("ai.provider", { baseUrl: active.baseUrl, model: active.model });
      if (active.apiKey.trim()) {
        await api.setSetting("OPENAI_API_KEY", active.apiKey.trim());
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
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
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
            <div className="flex items-center gap-2">
              <select
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                value={activeId ?? ""}
                onChange={(e) => {
                  setActiveId(e.target.value);
                  setModels([]);
                }}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button variant="secondary" onClick={addProvider}>
                Add
              </Button>
              {providers.length > 1 && active && (
                <Button variant="danger" onClick={() => deleteProvider(active.id)}>
                  Delete
                </Button>
              )}
            </div>

            {active && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                  <Input
                    label="Name"
                    value={active.name}
                    onChange={(e) => updateActive({ name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Base URL</label>
                  <Input
                    label="Base URL"
                    value={active.baseUrl}
                    onChange={(e) => updateActive({ baseUrl: e.target.value })}
                    placeholder="https://api.example.com/v1"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Model</label>
                  {models.length > 0 ? (
                    <select
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      value={active.model}
                      onChange={(e) => updateActive({ model: e.target.value })}
                    >
                      {models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      label="Model"
                      value={active.model}
                      onChange={(e) => updateActive({ model: e.target.value })}
                      placeholder="model-name"
                    />
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">API Key</label>
                  <Input
                    label="API Key"
                    type="password"
                    value={active.apiKey}
                    onChange={(e) => updateActive({ apiKey: e.target.value })}
                    placeholder="sk-..."
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={fetchModels} disabled={loadingModels || !active.baseUrl}>
                    {loadingModels ? "Fetching..." : "Fetch models"}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={loadingModels || !active.baseUrl || !active.model}
                    onClick={async () => {
                      setSaving(true);
                      setError(null);
                      setSuccess(null);
                      try {
                        const res = await api.aiTestConnection(active.baseUrl, active.model, active.apiKey);
                        setSuccess(`Connection OK (HTTP ${res.status}).`);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Connection failed.");
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Test connection
                  </Button>
                </div>
              </div>
            )}

            <Alert tone={error ? "error" : success ? "success" : "info"}>
              {error || success || "Changes apply to future AI requests only."}
            </Alert>

            <div className="flex justify-end gap-2">
              <Button variant="tertiary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving || !active}>
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
