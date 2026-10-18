import { describe, expect, it } from "vitest";
import { followUpRequest, parseSuggestions, suggestFollowUps } from "./suggestions.ts";

const lines = [
  { role: "user" as const, text: "Postgres is on 5433" },
  { role: "assistant" as const, text: "Noted." },
];

describe("parseSuggestions", () => {
  it("keeps three distinct lines and drops blanks, duplicates, and overlong ones", () => {
    const raw = JSON.stringify({
      suggestions: [
        "  What port? ",
        "what port?",
        "",
        "a".repeat(161),
        "Show the schema",
        "Which ORM?",
        "One more",
      ],
    });
    expect(parseSuggestions(raw)).toEqual(["What port?", "Show the schema", "Which ORM?"]);
  });

  it("returns nothing when the model does not return the list", () => {
    expect(parseSuggestions("sure, here are some ideas")).toEqual([]);
    expect(parseSuggestions('{"suggestions":"What port?"}')).toEqual([]);
  });
});

describe("suggestFollowUps", () => {
  it("sends the transcript as a prompt and does not pass tools", async () => {
    let seen: { system?: string; prompt?: string; tools?: unknown } | undefined;
    const got = await suggestFollowUps(lines, async (request) => {
      seen = { ...request };
      return JSON.stringify({ suggestions: ["What port?", "What port?", "Show the schema"] });
    });
    expect(seen?.prompt).toContain("Postgres is on 5433");
    expect(seen?.system).toContain("JSON");
    expect(seen?.tools).toBeUndefined();
    expect(Object.keys(seen ?? {}).sort()).toEqual(["prompt", "system"]);
    expect(got).toEqual(["What port?", "Show the schema"]);
  });

  it("returns nothing when the model call fails", async () => {
    const got = await suggestFollowUps(lines, async () => {
      throw new Error("upstream");
    });
    expect(got).toEqual([]);
  });
});

describe("followUpRequest", () => {
  it("is only a system string and a prompt", () => {
    expect(Object.keys(followUpRequest(lines)).sort()).toEqual(["prompt", "system"]);
  });
});
