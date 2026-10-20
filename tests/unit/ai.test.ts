import { describe, it, expect } from "vitest";
import type { Env } from "../../src/worker/env";
import { getAiConfig, isTrustedAiOrigin } from "../../src/worker/services/ai";

describe("getAiConfig", () => {
  it("uses defaults", () => {
    const cfg = getAiConfig({} as unknown as Env);

    expect(cfg.baseUrl).toBe("https://opencode.ai/zen/v1");
    expect(cfg.model).toBe("deepseek-v4.1-flash-free");
  });

  it("prefers an explicitly saved settings API key", () => {
    // Settings are now auth-protected, so an operator-saved key may override
    // the (possibly empty) environment key.
    const env = { OPENAI_API_KEY: "env-secret" } as unknown as Env;
    const cfg = getAiConfig(env, {
      OPENAI_API_KEY: "settings-key",
    });

    expect(cfg.apiKey).toBe("settings-key");
    expect(cfg.apiKeyFromSettings).toBe(true);
  });

  it("falls back to the environment key when settings has none", () => {
    const env = { OPENAI_API_KEY: "env-secret" } as unknown as Env;
    const cfg = getAiConfig(env, {});

    expect(cfg.apiKey).toBe("env-secret");
    expect(cfg.apiKeyFromSettings).toBe(false);
  });

  it("trusts only the configured inference origin", () => {
    const env = { OPENAI_BASE_URL: "https://opencode.ai/zen/v1" } as unknown as Env;

    expect(isTrustedAiOrigin("https://opencode.ai/zen/v1/chat", env)).toBe(true);
    expect(isTrustedAiOrigin("https://evil.example.com", env)).toBe(false);
    expect(isTrustedAiOrigin("not a url", env)).toBe(false);
  });
});
