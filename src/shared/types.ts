export type Prompt = {
  id: string;
  title: string;
  content: string;
  role?: string;
  variables?: string[];
  constraints?: string;
  examples?: string;
  tags?: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type Template = {
  id: string;
  name: string;
  body: string;
  variables?: string[];
  createdAt: string;
  updatedAt: string;
};

export type Skill = {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  tools?: string[];
  examples?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

export type Evaluation = {
  id: string;
  targetType: "prompt" | "skill";
  targetId: string;
  score: number | null;
  feedback?: unknown;
  model?: string;
  createdAt: string;
};

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };
