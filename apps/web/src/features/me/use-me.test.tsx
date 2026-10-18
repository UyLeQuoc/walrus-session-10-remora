import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMe } from "./use-me";

function Probe() {
  useMe();
  return null;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useMe", () => {
  it("asks who you are once when the sidebar and the page both mount", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.endsWith("/api/me/memories")
        ? { memories: [] }
        : { mode: "owned", signedIn: true, walletAddress: "0xabc" };
      return { ok: true, status: 200, json: async () => body } as Response;
    });
    vi.stubGlobal("fetch", fetch);

    render(
      <>
        <Probe />
        <Probe />
      </>,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const meCalls = fetch.mock.calls.filter((call) => {
      const path = String(call[0]);
      return path.endsWith("/api/me");
    });
    expect(meCalls).toHaveLength(1);
  });
});
