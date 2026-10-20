export type Env = {
  ASSETS?: Fetcher;
  DB: D1Database;
  CACHE: KVNamespace;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  OPENAI_API_KEY?: string;
  /**
   * Optional allowlist of additional `https://` origins that user-writable
   * `ai.provider` overrides may point at (comma-separated). Anything not in
   * this list — including public AI origins the operator did not opt into —
   * is rejected at write time. Secrets are never attached to these hosts.
   */
  AI_PROVIDER_ALLOWLIST?: string;
};
