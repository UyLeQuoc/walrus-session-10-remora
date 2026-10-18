import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UiMessage } from "@/features/chat/transcript";
import { useChatCitations } from "@/features/chat/use-chat-citations";

const CHAT_A = "11111111-1111-4111-8111-111111111111";
const CHAT_B = "22222222-2222-4222-8222-222222222222";

function cited(id: string): UiMessage {
  return {
    id,
    role: "assistant",
    parts: [{ type: "text", text: "Noted." }],
    metadata: { cites: [{ blobId: "blob-keep", type: "profile", distance: 0.2 }] },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const found = {
  status: "complete",
  limited: false,
  messages: [
    {
      id: "a1",
      recalled: [{ type: "profile", text: "I use pnpm", relevance: 0.8, blobId: "blob-keep" }],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChatCitations", () => {
  it("does not apply a late result after the chat changes", async () => {
    let release: (value: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );
    const apply = vi.fn();
    const { rerender, result } = renderHook(
      ({ id, messages }: { id: string; messages: UiMessage[] }) =>
        useChatCitations(id, messages, apply),
      { initialProps: { id: CHAT_A, messages: [cited("a1")] } },
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    rerender({ id: CHAT_B, messages: [] });
    await act(async () => {
      release(jsonResponse(found));
    });
    expect(apply).not.toHaveBeenCalled();
    expect(result.current.note).toBe("");
  });

  it("applies a complete read onto the messages that are on screen, including one that arrived while loading", async () => {
    let release: (value: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );
    const apply = vi.fn();
    const { rerender } = renderHook(
      ({ messages }: { messages: UiMessage[] }) => useChatCitations(CHAT_A, messages, apply),
      { initialProps: { messages: [cited("a1")] } },
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const newer: UiMessage = {
      id: "a2",
      role: "assistant",
      parts: [{ type: "text", text: "Still here." }],
    };
    rerender({ messages: [cited("a1"), newer] });
    await act(async () => {
      release(jsonResponse(found));
    });
    expect(apply).toHaveBeenCalledOnce();
    const next = apply.mock.calls[0]?.[0] as UiMessage[];
    expect(next.map((message) => message.id)).toEqual(["a1", "a2"]);
    expect(next[0]?.metadata?.recalled?.[0]?.text).toBe("I use pnpm");
    expect(next[0]?.metadata?.cites).toBeUndefined();
    expect(next[1]).toEqual(newer);
  });

  it("shows a partial read and does not pretend an unavailable read found nothing", async () => {
    const bodies = [
      {
        status: "unavailable",
        limited: true,
        message: "Walrus Memory could not be reached just now. Try again.",
        messages: [{ id: "a1", recalled: [] }],
      },
      found,
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(bodies.shift() ?? found)),
    );
    const apply = vi.fn();
    const { result } = renderHook(() => useChatCitations(CHAT_A, [cited("a1")], apply));
    await waitFor(() => expect(result.current.retry).toEqual(expect.any(Function)));
    expect(apply).not.toHaveBeenCalled();
    expect(result.current.note).toMatch(/could not be reached/i);
    await act(async () => {
      result.current.retry?.();
    });
    await waitFor(() => expect(apply).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the answer when the citation route fails, and offers another try", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "That chat is gone." }, 404)),
    );
    const apply = vi.fn();
    const { result } = renderHook(() => useChatCitations(CHAT_A, [cited("a1")], apply));
    await waitFor(() => expect(result.current.note).toMatch(/gone|try again/i));
    expect(apply).not.toHaveBeenCalled();
    expect(result.current.retry).toEqual(expect.any(Function));
  });

  it("does not ask again when the wording is already on the message", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const ready: UiMessage = {
      ...cited("a1"),
      metadata: {
        recalled: [{ type: "profile", text: "I use pnpm", relevance: 0.8, blobId: "blob-keep" }],
      },
    };
    renderHook(() => useChatCitations(CHAT_A, [ready], vi.fn()));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
