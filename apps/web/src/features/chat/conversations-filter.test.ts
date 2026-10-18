import { describe, expect, it } from "vitest";
import { filterConversations } from "./conversations-filter";

const items = [
  { id: "1", title: "Postgres on 5433", updatedAt: "2026-09-26T00:00:00.000Z" },
  { id: "2", title: "Vietnamese answers", updatedAt: "2026-09-26T00:00:00.000Z" },
];

describe("filterConversations", () => {
  it("returns every chat when the query is empty", () => {
    expect(filterConversations(items, "   ").map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("matches the title without regard to case", () => {
    expect(filterConversations(items, "postgres").map((item) => item.id)).toEqual(["1"]);
  });
});
