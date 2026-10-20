import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/worker/env";
import app from "../../src/worker/routes/ai";

// Auth is covered by the auth suite; here every request is a valid session so
// the base-URL gate is the only thing under test.
vi.mock("../../src/worker/db/auth", () => ({
  getSessionUser: vi.fn(async () => ({ id: "u-1", username: "tester", role: "user" })),
}));

const TRUSTED_BASE_URL = "https://opencode.ai/zen/v1";
const ENV_SECRET = "env-secret";

function makeEnv(overrides: Partial<Record<string, string>> = {}): Env {
  return {
    DB: {} as unknown,
    OPENAI_API_KEY: ENV_SECRET,
    OPENAI_BASE_URL: TRUSTED_BASE_URL,
    ...overrides,
  } as unknown as Env;
}

const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
  return new Response(JSON.stringify({ data: [{ id: "m-1" }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});

async function post(path: string, body: unknown, env: Env = makeEnv()): Promise<Response> {
  return app.request(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer session-token" },
      body: JSON.stringify(body),
    },
    env,
  );
}

function sentHeaders(): Record<string, string> {
  const init = fetchMock.mock.calls[0]?.[1];
  return (init?.headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

describe("POST /api/ai/models base URL gate", () => {
  it.each([
    ["link-local metadata IP over http", "http://169.254.169.254/latest/meta-data"],
    ["https metadata IP", "https://169.254.169.254/latest/meta-data"],
    ["localhost over http", "http://localhost:11434/v1"],
    ["localhost over https", "https://localhost/v1"],
    ["loopback IP", "https://127.0.0.1/v1"],
  ])("rejects %s before any fetch", async (_label, baseUrl) => {
    const res = await post("/models", { baseUrl });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("baseUrl must be a public https URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-allowlisted public origin when no caller key is supplied", async () => {
    const res = await post("/models", { baseUrl: "https://evil.example/v1" });

    expect(res.status).toBe(403);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("baseUrl origin is not allowed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the configured origin and attaches the env key only there", async () => {
    const res = await post("/models", { baseUrl: TRUSTED_BASE_URL });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: { models: string[] } };
    expect(json.ok).toBe(true);
    expect(json.data.models).toEqual(["m-1"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${TRUSTED_BASE_URL}/models`);
    expect(sentHeaders().Authorization).toBe(`Bearer ${ENV_SECRET}`);
  });

  it("accepts an allowlisted origin from AI_PROVIDER_ALLOWLIST", async () => {
    const env = makeEnv({ AI_PROVIDER_ALLOWLIST: "api.example.com" });
    const res = await post("/models", { baseUrl: "https://api.example.com/v1" }, env);

    expect(res.status).toBe(200);
    expect(sentHeaders().Authorization).toBe(`Bearer ${ENV_SECRET}`);
  });

  it("never leaks the env key to an untrusted origin that brings its own key", async () => {
    const res = await post("/models", { baseUrl: "https://public.example/v1", apiKey: "caller-key" });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentHeaders().Authorization).toBe("Bearer caller-key");
  });
});

describe("POST /api/ai/test base URL gate", () => {
  const model = "test-model";

  it.each([
    ["link-local metadata IP over http", "http://169.254.169.254/latest/meta-data"],
    ["https metadata IP", "https://169.254.169.254/latest/meta-data"],
    ["localhost over http", "http://localhost:11434/v1"],
    ["localhost over https", "https://localhost/v1"],
    ["loopback IP", "https://127.0.0.1/v1"],
  ])("rejects %s before any fetch", async (_label, baseUrl) => {
    const res = await post("/test", { baseUrl, model });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("baseUrl must be a public https URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-allowlisted public origin when no caller key is supplied", async () => {
    const res = await post("/test", { baseUrl: "https://evil.example/v1", model });

    expect(res.status).toBe(403);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("baseUrl origin is not allowed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the configured origin and attaches the env key only there", async () => {
    const res = await post("/test", { baseUrl: TRUSTED_BASE_URL, model });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: { status: number } };
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${TRUSTED_BASE_URL}/chat/completions`);
    expect(sentHeaders().Authorization).toBe(`Bearer ${ENV_SECRET}`);
  });

  it("still requires a model", async () => {
    const res = await post("/test", { baseUrl: TRUSTED_BASE_URL });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("model is required");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
