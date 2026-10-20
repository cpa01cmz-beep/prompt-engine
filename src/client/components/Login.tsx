import { useState } from "react";
import { Button, Card, Input, Alert } from "./ui";
import { api } from "../lib/api";
import { setToken } from "../lib/auth";

export function Login({ onLogin }: { onLogin: (user: { id: string; username: string; role: string }) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(username, password);
      setToken(res.token);
      onLogin(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Prompt Engine Login</h1>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-3 text-xs text-slate-500">Default: admin / admin123</p>
      </Card>
    </div>
  );
}
