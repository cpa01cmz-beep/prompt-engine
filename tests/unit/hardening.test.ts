import { describe, it, expect } from "vitest";
import { isPublicHttpsUrl } from "../../src/worker/lib/url";
import { parseAiProvider } from "../../src/worker/services/aiProvider";
import { clampListLimit, escapeLike, parseStringArray } from "../../src/worker/db/utils";

describe("isPublicHttpsUrl", () => {
  it("accepts public https origins", () => {
    expect(isPublicHttpsUrl("https://opencode.ai/zen/v1")).toBe(true);
    expect(isPublicHttpsUrl("https://api.openai.com/v1/")).toBe(true);
  });

  it("rejects non-https, localhost, private IPs, credentials, junk", () => {
    expect(isPublicHttpsUrl("http://opencode.ai")).toBe(false);
    expect(isPublicHttpsUrl("https://localhost/v1")).toBe(false);
    expect(isPublicHttpsUrl("https://sub.localhost/v1")).toBe(false);
    expect(isPublicHttpsUrl("https://127.0.0.1/v1")).toBe(false);
    expect(isPublicHttpsUrl("https://10.0.0.1/v1")).toBe(false);
    expect(isPublicHttpsUrl("https://172.16.0.1/v1")).toBe(false);
    expect(isPublicHttpsUrl("https://192.168.1.1/v1")).toBe(false);
    expect(isPublicHttpsUrl("https://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isPublicHttpsUrl("https://[::1]/v1")).toBe(false);
    expect(isPublicHttpsUrl("https://user:pass@example.com")).toBe(false);
    expect(isPublicHttpsUrl("not a url")).toBe(false);
    expect(isPublicHttpsUrl("")).toBe(false);
  });
});

describe("parseAiProvider", () => {
  const env = { OPENAI_BASE_URL: "https://opencode.ai/zen/v1" };
  const envWithAllowlist = { OPENAI_BASE_URL: "https://opencode.ai/zen/v1", AI_PROVIDER_ALLOWLIST: "api.openai.com, https://example.ai/v1" };

  it("accepts valid provider shapes for trusted origins", () => {
    expect(parseAiProvider({ baseUrl: "https://opencode.ai/zen/v1", model: "test-model" }, env)).toEqual({
      baseUrl: "https://opencode.ai/zen/v1",
      model: "test-model",
    });
    expect(parseAiProvider({ baseUrl: "https://api.openai.com/v1", model: "m" }, envWithAllowlist)).toEqual({
      baseUrl: "https://api.openai.com/v1",
      model: "m",
    });
  });

  it("accepts public https origins", () => {
    expect(parseAiProvider({ baseUrl: "https://api.openai.com/v1", model: "m" }, env)).toEqual({
      baseUrl: "https://api.openai.com/v1",
      model: "m",
    });
    expect(parseAiProvider({ baseUrl: "https://evil.com/v1", model: "m" }, env)).toEqual({
      baseUrl: "https://evil.com/v1",
      model: "m",
    });
  });

  it("rejects malformed or unsafe provider shapes", () => {
    expect(parseAiProvider(null, env)).toBeNull();
    expect(parseAiProvider("nope", env)).toBeNull();
    expect(parseAiProvider({ baseUrl: "http://opencode.ai", model: "m" }, env)).toBeNull();
    expect(parseAiProvider({ baseUrl: "https://10.0.0.5", model: "m" }, env)).toBeNull();
    expect(parseAiProvider({ baseUrl: "https://opencode.ai", model: "" }, env)).toBeNull();
  });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards and backslashes", () => {
    expect(escapeLike("100%_done\\x")).toBe("100\\%\\_done\\\\x");
  });
});

describe("parseStringArray", () => {
  it("parses string arrays and degrades everything else", () => {
    expect(parseStringArray('["a","b"]')).toEqual(["a", "b"]);
    expect(parseStringArray(null)).toBeUndefined();
    expect(parseStringArray("[1,2]")).toBeUndefined();
    expect(parseStringArray("[]")).toEqual([]);
    expect(parseStringArray("not json")).toBeUndefined();
  });
});

describe("clampListLimit", () => {
  it("defaults and bounds page size", () => {
    expect(clampListLimit(undefined)).toBe(100);
    expect(clampListLimit("")).toBe(100);
    expect(clampListLimit("abc")).toBe(100);
    expect(clampListLimit("0")).toBe(100);
    expect(clampListLimit("10")).toBe(10);
    expect(clampListLimit("99999")).toBe(200);
  });
});
