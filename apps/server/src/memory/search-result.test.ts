import { parseMemoryText, type RecalledMemory } from "@remora/memory";
import { describe, expect, it } from "vitest";
import { searchResult } from "./search-result.ts";

function hit(text: string, distance: number, blobId = "blob-1"): RecalledMemory {
  return { blob_id: blobId, text, distance, parsed: parseMemoryText(text) };
}

describe("searchResult", () => {
  it("returns the fact without the tags, as a relevance", () => {
    const out = searchResult(
      hit("[decision] [by:@mai] [#web] [2026-10-01] We deploy on Tuesdays", 0.236),
      new Set(),
    );
    expect(out).toEqual({
      mine: false,
      text: "We deploy on Tuesdays",
      type: "decision",
      relevance: 0.76,
      blobId: "blob-1",
      explorerUrl: "https://walruscan.com/mainnet/blob/blob-1",
    });
  });

  it("marks what this person wrote", () => {
    const out = searchResult(
      hit("[profile] [by:@mai] [2026-10-01] Likes tea", 0.1),
      new Set(["blob-1"]),
    );
    expect(out.mine).toBe(true);
  });

  it("never names the author, even when the text does not parse", () => {
    const out = searchResult(hit("[note] [by:@teammate] [2026-10-01] Use bun", 0.2), new Set());
    expect(out.type).toBeNull();
    expect(out.text).not.toContain("teammate");
    expect(out.text).toBe("[note] [2026-10-01] Use bun");
  });
});
