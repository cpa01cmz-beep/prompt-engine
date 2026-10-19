import { describe, it, expect } from "vitest";
import type { Env } from "../../src/worker/env";
import { getAiConfig } from "../../src/worker/services/ai";

describe("getAiConfig", () => {
  it("uses defaults", () => {
    const cfg = getAiConfig({} as unknown as Env);

    expect(cfg.baseUrl).toBe("https://opencode.ai/zen/v1");
    expect(cfg.model).toBe("deepseek-v4-flash-free");
  });
});
