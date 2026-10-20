import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "hono";
import app from "../../src/worker/index";
import { mapOutboundError } from "../../src/worker/lib/outboundError";

const UPSTREAM_DETAIL = '__upstream_detail__ {"error":"internal"}';

const mockEnv = {
  DB: {} as unknown,
  CACHE: undefined as unknown,
};

/** Minimal stand-in for a Hono context: c.json is the only capability used. */
function fakeContext(): Context {
  return {
    json: (data: unknown, status?: number) =>
      new Response(JSON.stringify(data), { status: status ?? 200 }),
  } as unknown as Context;
}

describe("mapOutboundError", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleErrorSpy.mockClear();
  });

  it("maps any outbound failure to a generic 502 body", async () => {
    const res = mapOutboundError(fakeContext(), new Error(`AI request failed: 500 ${UPSTREAM_DETAIL}`));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, error: "Upstream AI error" });
  });

  it("logs the cause server-side without surfacing it to the client", async () => {
    const cause = new Error(`AI request failed: 500 ${UPSTREAM_DETAIL}`);
    const res = mapOutboundError(fakeContext(), cause);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[1]).toBe(cause);
    expect(JSON.stringify(await res.json() as unknown)).not.toContain("upstream_detail");
  });

  it("JSON response body of a failing upstream is only logged server-side", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(UPSTREAM_DETAIL, { status: 500 })));

    const res = await app.request(
      "/api/ai/generate-prompt",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "write a sonnet about sensors" }),
      },
      mockEnv as never,
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, error: "Upstream AI error" });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleErrorSpy.mock.calls[0]?.[1])).toContain("upstream_detail");
  });

  it("speaking to a rejecting upstream also yields the generic 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const res = await app.request(
      "/api/search/web?q=prompt-engineering",
      { method: "GET" },
      mockEnv as never,
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, error: "Upstream AI error" });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
