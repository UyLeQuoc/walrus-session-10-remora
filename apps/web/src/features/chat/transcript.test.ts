import { describe, expect, it } from "vitest";
import {
  applyResolved,
  citationKey,
  resolvedFrom,
  toUiMessages,
  type UiMessage,
} from "./transcript.ts";

describe("toUiMessages", () => {
  it("keeps text and marks commands, and drops a row that is not a message", () => {
    const messages = toUiMessages([
      { id: "u1", role: "user", kind: "turn", text: "hello" },
      { id: "a1", role: "assistant", kind: "command", text: "/help" },
      { id: 1, role: "user", kind: "turn", text: "nope" },
    ]);
    expect(messages).toEqual([
      { id: "u1", role: "user", parts: [{ type: "text", text: "hello" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "/help" }],
        metadata: { command: true },
      },
    ]);
  });

  it("keeps a command table on the assistant reply and drops a link that is not openable", () => {
    const messages = toUiMessages([
      {
        id: "a1",
        role: "assistant",
        kind: "command",
        text: "Mode: owned.",
        table: {
          columns: ["Field", "Value"],
          rows: [
            { cells: ["Namespace", "hippo"], copy: "hippo" },
            { cells: ["Site", "nope"], copy: "http://example.com", href: "http://example.com" },
          ],
        },
      },
    ]);
    expect(messages[0]?.metadata?.table?.rows[0]?.copy).toBe("hippo");
    expect(messages[0]?.metadata?.table?.rows[1]?.href).toBeUndefined();
    expect(messages[0]?.metadata?.table?.rows[1]?.copy).toBe("http://example.com");
  });

  it("keeps citation ids and drops a hidden blob once resolve omits it", () => {
    const messages = toUiMessages([
      {
        id: "a1",
        role: "assistant",
        kind: "turn",
        text: "Noted.",
        cites: [
          { blobId: "blob-keep", type: "profile", distance: 0.2 },
          { blobId: "blob-hidden", type: "profile", distance: 0.4 },
        ],
      },
    ]);
    expect(messages[0]?.metadata?.cites?.map((cite) => cite.blobId)).toEqual([
      "blob-keep",
      "blob-hidden",
    ]);
    const resolved = applyResolved(messages, [
      {
        id: "a1",
        recalled: [{ type: "profile", text: "I use pnpm", relevance: 0.8, blobId: "blob-keep" }],
      },
    ]);
    expect(resolved[0]?.metadata?.cites).toBeUndefined();
    expect(resolved[0]?.metadata?.recalled?.map((item) => item.blobId)).toEqual(["blob-keep"]);
    expect(JSON.stringify(resolved)).not.toContain("blob-hidden");
  });

  it("keeps a partial citation read instead of treating it as no memory", () => {
    const resolved = resolvedFrom({
      status: "partial",
      limited: true,
      message: "Could not read every source back from Walrus just now. Try again.",
      messages: [
        {
          id: "a1",
          recalled: [{ type: "profile", text: "I use pnpm", relevance: 0.8, blobId: "blob-keep" }],
        },
      ],
    });
    expect(resolved?.status).toBe("partial");
    expect(resolved?.messages[0]?.recalled[0]?.text).toBe("I use pnpm");
    expect(
      citationKey(
        "chat-1",
        toUiMessages([
          {
            id: "a1",
            role: "assistant",
            kind: "turn",
            text: "Noted.",
            cites: [{ blobId: "blob-keep", type: "profile", distance: 0.2 }],
          },
        ]),
      ),
    ).toBe("chat-1:a1");
  });

  it("does not fetch again once the wording is already on the answer", () => {
    const messages = toUiMessages([
      {
        id: "a1",
        role: "assistant",
        kind: "turn",
        text: "Noted.",
        cites: [{ blobId: "blob-keep", type: "profile", distance: 0.2 }],
        recalled: [{ type: "profile", text: "I use pnpm", relevance: 0.8, blobId: "blob-keep" }],
      },
    ]);
    expect(citationKey("chat-1", messages)).toBe("");
    expect(citationKey(null, messages)).toBe("");
  });

  it("keeps a newer line when an older resolve arrives, and strips a hidden cite", () => {
    const older = toUiMessages([
      {
        id: "a1",
        role: "assistant",
        kind: "turn",
        text: "Noted.",
        cites: [{ blobId: "blob-hidden", type: "profile", distance: 0.2 }],
      },
    ]);
    const newer: UiMessage = {
      id: "a2",
      role: "assistant",
      parts: [{ type: "text", text: "Still streaming." }],
    };
    const next = applyResolved([...older, newer], [{ id: "a1", recalled: [] }]);
    expect(next[0]?.metadata).toBeUndefined();
    expect(next[1]).toEqual(newer);
    expect(JSON.stringify(next)).not.toContain("blob-hidden");
  });

  it("reads an old limited body as unavailable and rejects a body that is not a read", () => {
    expect(resolvedFrom({ limited: true, message: "Give me a minute." })).toEqual({
      status: "unavailable",
      limited: true,
      message: "Give me a minute.",
      messages: [],
    });
    expect(resolvedFrom(null)).toBeNull();
    expect(resolvedFrom({ limited: false })).toBeNull();
    expect(
      resolvedFrom({
        status: "complete",
        messages: [{ id: "a1", recalled: [{ type: "profile", text: 1 }] }],
      })?.messages[0]?.recalled,
    ).toEqual([]);
  });
});
