import { describe, expect, it } from "vitest";
import { followUpList } from "./follow-ups";

describe("followUpList", () => {
  it("keeps the strings and drops everything else", () => {
    expect(followUpList({ suggestions: ["What port?", "", 3, "Show the schema"] })).toEqual([
      "What port?",
      "Show the schema",
    ]);
    expect(followUpList(null)).toEqual([]);
    expect(followUpList({ suggestions: "What port?" })).toEqual([]);
  });
});
