/**
 * How a turn gathers memory: what it asks for, and in what order.
 *
 * Measured 2026-09-24, each recall costs about a second, and a session's first
 * turn used to run five of them before the model could say a word
 * (docs/evidence/latency-2026-09-24.md).
 */
import type { MemoryPort, RecalledMemory } from "@remora/memory";
import { describe, expect, it } from "vitest";
import { gatherContext, type TurnInput } from "./agent.ts";

function fact(type: string, text: string, created_at: string): RecalledMemory {
  return {
    blob_id: `${type}:${text}`,
    text: `[${type}] [by:@mai] [2026-09-24] ${text}`,
    distance: 0.4,
    created_at,
    parsed: { type: type as never, tags: {}, date: "2026-09-24", text },
  };
}

/** A port whose recalls resolve after `delayMs`, logging when each one started. */
function slowPort(delayMs: number, answer: (query: string) => RecalledMemory[]) {
  const started: Array<{ query: string; at: number }> = [];
  const t0 = Date.now();
  const port = {
    scope: { mode: "guest", namespace: "t", key: "", accountId: "", serverUrl: "" },
    recall: async ({ query }: { query: string }) => {
      started.push({ query, at: Date.now() - t0 });
      await new Promise((r) => setTimeout(r, delayMs));
      return answer(query);
    },
    remember: async () => ({ saved: true, note: "" }),
    flush: async () => {},
  } as unknown as MemoryPort;
  return { port, started };
}

const input = (port: MemoryPort, extra: Partial<TurnInput> = {}): TurnInput => ({
  model: {} as never,
  port,
  messages: [{ role: "user", content: "which package manager?" }],
  channel: "test",
  userHandle: "mai",
  memoryEnabled: true,
  ...extra,
});

describe("gatherContext", () => {
  it("asks a session's first turn two questions, not four", async () => {
    const { port, started } = slowPort(1, () => []);
    await gatherContext(input(port, { sessionStart: true }));
    // The message, and one pull on the type tags, which returns what three
    // separate profile, style and commitment queries used to.
    expect(started.map((s) => s.query)).toEqual([
      "which package manager?",
      "[profile] [style] [commitment]",
    ]);
  });

  it("skips the corrections recall for someone who has never corrected anything", async () => {
    const { port, started } = slowPort(1, () => [
      fact("profile", "uses pnpm", "2026-09-24T10:00:00Z"),
    ]);
    await gatherContext(input(port, { hasCorrections: false }));
    expect(started.map((s) => s.query)).not.toContain("[correction]");
  });

  it("still pulls corrections when it does not know, and puts the newest first", async () => {
    const { port, started } = slowPort(1, (q) =>
      q === "[correction]"
        ? [fact("correction", "moved to bun", "2026-09-24T10:05:00Z")]
        : [fact("profile", "uses pnpm", "2026-09-24T10:00:00Z")],
    );
    const ctx = await gatherContext(input(port));
    expect(started.map((s) => s.query)).toContain("[correction]");
    expect(ctx.injected.map((m) => m.parsed?.type)).toEqual(["correction", "profile"]);
  });

  it("does not start a recall after the caller has stopped", async () => {
    const controller = new AbortController();
    controller.abort();
    const { port, started } = slowPort(1, () => []);
    const ctx = await gatherContext(
      input(port, { abortSignal: controller.signal, sessionStart: true }),
    );
    expect(started).toEqual([]);
    expect(ctx.injected).toEqual([]);
  });
});
