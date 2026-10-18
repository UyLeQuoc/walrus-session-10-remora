import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChatMemories } from "@/features/chat/use-chat-memories";

const CHAT = "11111111-1111-4111-8111-111111111111";
const INDEX = "33333333-3333-4333-8333-333333333333";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChatMemories", () => {
  it("hides a loaded card immediately and does not offer its missing wording as a fact", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path.endsWith("/memories")) {
          return json({
            limited: true,
            message: "Could not read every fact back from Walrus just now.",
            memories: [
              { id: INDEX, type: "profile", text: null, status: "stored", blobId: "blob-1" },
            ],
          });
        }
        return json({}, 404);
      }),
    );
    const { result } = renderHook(() => useChatMemories(CHAT, false));
    await waitFor(() => expect(result.current.cards).toHaveLength(1));
    expect(result.current.cards[0]?.textKnown).toBe(false);
    expect(result.current.error).toMatch(/could not read every fact/i);
    act(() => {
      result.current.conceal(INDEX);
    });
    expect(result.current.cards[0]?.hidden).toBe(true);
  });

  it("turns a pending card stored when the write lands, without calling the relayer", async () => {
    let listed = false;
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        urls.push(path);
        if (path.endsWith("/status")) {
          return json({ status: "stored", blobId: "blob-1", hidden: false, type: "profile" });
        }
        listed = true;
        return json({
          limited: false,
          memories: [{ id: INDEX, type: "profile", text: "I use pnpm", status: "pending" }],
        });
      }),
    );
    const { result } = renderHook(() => useChatMemories(CHAT, false));
    await waitFor(() => expect(result.current.cards[0]?.status).toBe("stored"));
    expect(listed).toBe(true);
    expect(urls.some((url) => url.includes("relayer"))).toBe(false);
    expect(result.current.cards[0]?.blobId).toBe("blob-1");
  });

  it("says the chat could not be loaded and does not invent cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({}, 500)),
    );
    const { result } = renderHook(() => useChatMemories(CHAT, false));
    await waitFor(() => expect(result.current.error).toMatch(/could not load/i));
    expect(result.current.cards).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("treats a chat the server does not have yet as empty, and reads it again after the turn", async () => {
    let created = false;
    const fetchMock = vi.fn(async () =>
      created
        ? json({
            limited: false,
            memories: [{ id: INDEX, type: "profile", text: "I use bun", status: "stored" }],
          })
        : json({}, 404),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ busy }) => useChatMemories(CHAT, busy), {
      initialProps: { busy: true },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("");
    expect(result.current.cards).toEqual([]);
    created = true;
    rerender({ busy: false });
    await waitFor(() => expect(result.current.cards).toHaveLength(1));
    expect(result.current.error).toBe("");
    const paths = () => fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(paths().filter((path) => path.includes(`/${CHAT}/memories`))).toHaveLength(2);
    await waitFor(() => expect(paths()).toContain("/api/me"));
  });

  it("refreshes the summary under the box once a write lands", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        urls.push(path);
        if (path.endsWith("/status")) {
          return json({ status: "stored", blobId: "blob-1", hidden: false, type: "profile" });
        }
        if (path.endsWith("/memories")) {
          return json({
            limited: false,
            memories: [{ id: INDEX, type: "profile", text: "I use pnpm", status: "pending" }],
          });
        }
        return json({ mode: "guest", memoryEnabled: true });
      }),
    );
    const { result } = renderHook(() => useChatMemories(CHAT, false));
    await waitFor(() => expect(result.current.cards[0]?.status).toBe("stored"));
    await waitFor(() => expect(urls).toContain("/api/me"));
  });
});
