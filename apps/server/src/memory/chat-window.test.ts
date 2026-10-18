import { describe, expect, it } from "vitest";
import {
  type ChatMemory,
  type IndexedMemory,
  indexedReadLimit,
  memoriesInWindow,
  storedWordingMissing,
  withRecalledText,
} from "./chat-window.ts";

function row(id: string, at: string, blobId: string | null = "blob-1"): IndexedMemory {
  return {
    id,
    type: "profile",
    status: "stored",
    blobId,
    hidden: false,
    createdAt: new Date(at),
  };
}

describe("memories written during a chat", () => {
  const start = new Date("2026-09-29T10:00:00.000Z");
  const end = new Date("2026-09-29T10:05:00.000Z");

  it("keeps a write that landed while the chat was open, and drops one from another hour", () => {
    const kept = memoriesInWindow(
      [row("in", "2026-09-29T10:02:00.000Z"), row("out", "2026-09-29T12:00:00.000Z")],
      start,
      end,
    );
    expect(kept.map((item) => item.id)).toEqual(["in"]);
    const edge = memoriesInWindow(
      [row("edge", "2026-09-29T09:59:30.000Z"), row("out", "2026-09-29T09:59:29.999Z")],
      start,
      end,
    );
    expect(edge.map((item) => item.id)).toEqual(["edge"]);
  });

  it("attaches recalled text and leaves a blob recall missed without wording", () => {
    const memories = withRecalledText(
      [
        row("a", "2026-09-29T10:02:00.000Z", "blob-keep"),
        row("b", "2026-09-29T10:03:00.000Z", "blob-miss"),
      ],
      new Map([["blob-keep", "I use pnpm"]]),
    );
    expect(memories[0]?.text).toBe("I use pnpm");
    expect(memories[1]?.text).toBeNull();
  });

  it("treats a stored blob without wording as missing, and a pending row as still writing", () => {
    const stored = memory("stored", "blob-miss", null);
    const pending = memory("pending", null, null);
    expect(storedWordingMissing([stored, pending])).toBe(true);
    expect(storedWordingMissing([pending])).toBe(false);
    expect(indexedReadLimit({ reached: true, missing: false })).toEqual({ limited: false });
    expect(indexedReadLimit({ reached: true, missing: true }).limited).toBe(true);
    expect(indexedReadLimit({ reached: false, missing: false }).limited).toBe(true);
    expect(
      indexedReadLimit({ reached: true, missing: false, blocked: "Give me a minute." }),
    ).toEqual({
      limited: true,
      message: "Give me a minute.",
    });
  });
});

function memory(
  status: ChatMemory["status"],
  blobId: string | null,
  text: string | null,
): ChatMemory {
  return { id: "m", type: "profile", text, status, blobId, hidden: false };
}
