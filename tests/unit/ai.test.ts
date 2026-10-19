import { describe, it, expect } from "vitest";
import type { Env } from "../../src/worker/env";
import { getAiConfig, isTrustedAiOrigin } from "../../src/worker/services/ai";

describe("getAiConfig", () => {
  it("uses defaults", () => {
    const cfg = getAiConfig({} as unknown as Env);

    expect(cfg.baseUrl).toBe("https://opencode.ai/zen/v1");
    expect(cfg.model).toBe("deepseek-v4-flash-free");
  });

  it("never sources the API key from settings", () => {
    // Settings are user-writable via /api/settings; the API key must only
    // ever come from the trusted environment configuration.
    const env = { OPENAI_API_KEY: "env-secret" } as unknown as Env;
    const cfg = getAiConfig(env, {
      OPENAI_API_KEY: "attacker-key",
      openai_api_key: "attacker-key-2",
    });

    expect(cfg.apiKey).toBe("env-secret");
  });

  it("trusts only the configured inference origin", () => {
    const env = { OPENAI_BASE_URL: "https://opencode.ai/zen/v1" } as unknown as Env;

    expect(isTrustedAiOrigin("https://opencode.ai/zen/v1/chat", env)).toBe(true);
    expect(isTrustedAiOrigin("https://evil.example.com", env)).toBe(false);
    expect(isTrustedAiOrigin("not a url", env)).toBe(false);
  });
});
