import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMemoryToggle } from "@/features/chat/use-memory-toggle";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMemoryToggle", () => {
  it("posts the opposite flag and does not post when memory is already that way", async () => {
    const fetchMock = vi.fn(async () => json({ memoryEnabled: false }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useMemoryToggle(true));
    await act(async () => {
      await result.current.toggle(true);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.toggle(false);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/memory",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ enabled: false }),
      }),
    );
    expect(result.current.error).toBe("");
    expect(result.current.pending).toBe(false);
  });

  it("keeps the old flag and says what failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "Give me a minute." }, 429)),
    );
    const { result } = renderHook(() => useMemoryToggle(true));
    await act(async () => {
      await result.current.toggle(false);
    });
    await waitFor(() => expect(result.current.error).toBe("Give me a minute."));
    expect(result.current.pending).toBe(false);
  });

  it("does nothing before the page knows whether memory is on", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useMemoryToggle(undefined));
    await act(async () => {
      await result.current.toggle(false);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
