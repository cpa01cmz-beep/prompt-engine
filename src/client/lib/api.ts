import type { Prompt, Skill, Template, WebSearchResult, SkillSearchResponse } from "@shared/types";

import { getToken } from "./auth";

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new Error(res.statusText || "Request failed");
  }
  if (!res.ok || !json.ok) {
    throw new Error(json.ok ? res.statusText || "Request failed" : json.error);
  }
  return json.data;
}

export const api = {
  getPrompts: (q?: string) =>
    request<Prompt[]>(`/api/prompts${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getPrompt: (id: string) => request<Prompt>(`/api/prompts/${id}`),
  createPrompt: (data: Omit<Prompt, "id" | "version" | "createdAt" | "updatedAt">) =>
    request<Prompt>("/api/prompts", { method: "POST", body: JSON.stringify(data) }),
  updatePrompt: (id: string, data: Partial<Prompt>) =>
    request<Prompt>(`/api/prompts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePrompt: (id: string) =>
    request<null>(`/api/prompts/${id}`, { method: "DELETE" }),

  getSkills: (q?: string) =>
    request<Skill[]>(`/api/skills${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getSkill: (id: string) => request<Skill>(`/api/skills/${id}`),
  createSkill: (data: Omit<Skill, "id" | "createdAt" | "updatedAt">) =>
    request<Skill>("/api/skills", { method: "POST", body: JSON.stringify(data) }),
  updateSkill: (id: string, data: Partial<Skill>) =>
    request<Skill>(`/api/skills/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSkill: (id: string) =>
    request<null>(`/api/skills/${id}`, { method: "DELETE" }),

  getTemplates: () => request<Template[]>("/api/templates"),
  getTemplate: (id: string) => request<Template>(`/api/templates/${id}`),
  createTemplate: (data: Omit<Template, "id" | "createdAt" | "updatedAt">) =>
    request<Template>("/api/templates", { method: "POST", body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: Partial<Template>) =>
    request<Template>(`/api/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTemplate: (id: string) =>
    request<null>(`/api/templates/${id}`, { method: "DELETE" }),

  searchWeb: (q: string) =>
    request<{ query: string; results: WebSearchResult[] }>(`/api/search/web?q=${encodeURIComponent(q)}`),

  aiChat: (messages: { role: "system" | "user" | "assistant"; content: string }[]) =>
    request<{ content: string }>("/api/ai/chat", { method: "POST", body: JSON.stringify({ messages }) }),

  aiGeneratePrompt: (goal: string) =>
    request<{ content: string }>("/api/ai/generate-prompt", { method: "POST", body: JSON.stringify({ goal }) }),
  aiEvaluatePrompt: (prompt: string) =>
    request<{ content: string }>("/api/ai/evaluate-prompt", { method: "POST", body: JSON.stringify({ prompt }) }),
  aiOptimizePrompt: (prompt: string) =>
    request<{ content: string }>("/api/ai/optimize-prompt", { method: "POST", body: JSON.stringify({ prompt }) }),

  aiGenerateSkill: (goal: string) =>
    request<{ content: string }>("/api/ai/generate-skill", { method: "POST", body: JSON.stringify({ goal }) }),
  aiEvaluateSkill: (skill: string) =>
    request<{ content: string }>("/api/ai/evaluate-skill", { method: "POST", body: JSON.stringify({ skill }) }),
  aiOptimizeSkill: (skill: string) =>
    request<{ content: string }>("/api/ai/optimize-skill", { method: "POST", body: JSON.stringify({ skill }) }),
  aiSearchSkills: (query: string) =>
    request<SkillSearchResponse>("/api/ai/search-skills", { method: "POST", body: JSON.stringify({ query }) }),

  getSettings: () => request<Record<string, string>>("/api/settings"),
  getSetting: <T>(key: string) => request<{ key: string; value: T }>(`/api/settings/${encodeURIComponent(key)}`),
  setSetting: <T>(key: string, value: T) =>
    request<{ key: string; value: T }>(`/api/settings/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
  login: (username: string, password: string) =>
    request<{ token: string; user: { id: string; username: string; role: string } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  getMe: () => request<{ id: string; username: string; role: string }>("/api/auth/me"),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  createUser: (username: string, password: string, role?: "admin" | "user") =>
    request<{ id: string; username: string; role: string }>("/api/auth/users", {
      method: "POST",
      body: JSON.stringify({ username, password, role }),
    }),

};
