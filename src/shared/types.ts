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

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type SearchSkillResult = WebSearchResult; // alias

// Candidate skills extracted by AI from web search results (/api/ai/search-skills).
export type SkillCandidate = {
  name: string;
  description?: string;
  url?: string;
};

// Response of POST /api/ai/search-skills. `webSearchUnavailable` tells the
// client the web-search leg failed (or was skipped) and `results` is empty
// because of that — not because nothing matched.
export type SkillSearchResponse = {
  content: string;
  results: WebSearchResult[];
  candidates: SkillCandidate[];
  webSearchUnavailable: boolean;
};

export type SearchResult = WebSearchResult;

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };
