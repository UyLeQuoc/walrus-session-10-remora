import { describe, expect, it } from "vitest";
import type { Memory } from "@/features/me/memory";
import { memoriesOfType, showsMemoryPagination } from "@/features/me/use-memories-table";

function memory(type: string): Memory {
  return {
    id: type,
    type,
    status: "stored",
    channel: "web",
    createdAt: "2026-09-01T00:00:00.000Z",
    blobId: null,
    expiresAt: null,
    ciphertextUrl: null,
    explorerUrl: null,
  };
}

describe("memories table rules", () => {
  it("filters by type locally and leaves all types alone", () => {
    const rows = [memory("profile"), memory("style"), memory("profile")];
    expect(memoriesOfType(rows, "all")).toHaveLength(3);
    expect(memoriesOfType(rows, "style").map((row) => row.type)).toEqual(["style"]);
  });

  it("paginates only once a page is full", () => {
    expect(showsMemoryPagination(10)).toBe(false);
    expect(showsMemoryPagination(11)).toBe(true);
  });
});
