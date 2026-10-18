import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiGet, apiPost } from "@/lib/api-request";

const reply = z.object({ left: z.string() });
const FALLBACK = "Could not do that just now.";

function serve(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      ({ ok: status < 400, status, json: async () => body }) as Response,
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("apiGet", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed reply", async () => {
    const fetchMock = serve(200, { left: "Platform", extra: true });
    expect(await apiGet("/api/x?q=1", reply, FALLBACK)).toEqual({
      ok: true,
      data: { left: "Platform" },
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/x?q=1");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBeUndefined();
  });

  it("passes on the server's sentence when the request is refused", async () => {
    serve(409, { error: "You are not in a team." });
    expect(await apiGet("/api/x", reply, FALLBACK)).toEqual({
      ok: false,
      error: "You are not in a team.",
    });
  });

  it("falls back to its own sentence when the refusal has none", async () => {
    serve(500, {});
    expect(await apiGet("/api/x", reply, FALLBACK)).toEqual({ ok: false, error: FALLBACK });
  });

  it("does not trust a reply that has the wrong shape", async () => {
    serve(200, { left: 3 });
    expect(await apiGet("/api/x", reply, FALLBACK)).toEqual({ ok: false, error: FALLBACK });
  });

  it("turns a network failure into the fallback sentence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    expect(await apiGet("/api/x", reply, FALLBACK)).toEqual({ ok: false, error: FALLBACK });
  });
});

describe("apiPost", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a body as JSON", async () => {
    const fetchMock = serve(200, { left: "Platform" });
    await apiPost("/api/x", reply, FALLBACK, { name: "Platform" });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ name: "Platform" }));
  });

  it("posts without a body when there is nothing to send", async () => {
    const fetchMock = serve(200, { left: "Platform" });
    expect(await apiPost("/api/x", reply, FALLBACK)).toEqual({
      ok: true,
      data: { left: "Platform" },
    });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
  });
});
