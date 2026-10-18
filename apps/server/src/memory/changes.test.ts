import type { RecalledMemory } from "@remora/memory";
import { describe, expect, it } from "vitest";
import { pairChange } from "./changes.ts";

function memory(
  blobId: string,
  type: string,
  text: string,
  date: string,
  distance: number,
  tags: Record<string, string> = {},
): RecalledMemory {
  return {
    blob_id: blobId,
    text: `[${type}] [${date}] ${text}`,
    distance,
    created_at: `${date}T00:00:00Z`,
    parsed: { type: type as never, tags, date, text },
  } as RecalledMemory;
}

const correction = memory(
  "c1",
  "correction",
  "We moved from pnpm to bun this week.",
  "2026-10-02",
  0,
);

describe("pairChange", () => {
  it("is certain when the correction names the blob it replaced", () => {
    const named = memory("c2", "correction", "Port is 6543 now.", "2026-10-02", 0, {
      replaces: "old-port",
    });
    const change = pairChange(named, [
      memory("other", "profile", "Port is 5433.", "2026-09-30", 0.1),
      memory("old-port", "gotcha", "Port is 5433.", "2026-09-29", 0.3),
    ]);
    expect(change.replaced).toMatchObject({ blobId: "old-port", certain: true });
  });

  it("offers the nearest older fact on the subject as probable, never certain", () => {
    const change = pairChange(correction, [
      correction,
      memory("p1", "profile", "I only use pnpm.", "2026-09-30", 0.35),
      memory("p2", "decision", "We use Drizzle.", "2026-09-30", 0.7),
    ]);
    expect(change.replaced).toMatchObject({ blobId: "p1", certain: false });
    expect(change.text).toBe("We moved from pnpm to bun this week.");
  });

  it("pairs nothing rather than a fact that came later or is off the subject", () => {
    const change = pairChange(correction, [
      memory("later", "profile", "I use bun.", "2026-10-03", 0.2),
      memory("far", "decision", "We use Drizzle.", "2026-09-30", 0.75),
    ]);
    expect(change.replaced).toBeNull();
  });
});
