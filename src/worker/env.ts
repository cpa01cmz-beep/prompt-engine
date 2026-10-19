export type Env = {
  ASSETS: Fetcher;
  DB: D1Database;
  CACHE: KVNamespace;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  OPENAI_API_KEY?: string;
};
