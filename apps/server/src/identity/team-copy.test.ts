import { describe, expect, it } from "vitest";
import {
  createRefusalSentence,
  joinedSentence,
  joinRefusalSentence,
  teamFactRefusalSentence,
  teamFactSentence,
} from "./team-copy.ts";

describe("team refusals", () => {
  it("says the same thing about being in a team whether creating or joining", () => {
    expect(createRefusalSentence("already-in-a-team")).toBe(
      "You are already in a team. Leave it first (/team leave).",
    );
    expect(joinRefusalSentence("already-in-a-team")).toBe(
      createRefusalSentence("already-in-a-team"),
    );
  });

  it("names what a valid name and code look like", () => {
    expect(createRefusalSentence("bad-name")).toContain("at least two characters");
    expect(joinRefusalSentence("unknown")).toBe("That is not a code. They look like ABC234.");
    expect(joinRefusalSentence("expired")).toBe(
      "That code has been used or has expired. Ask for another.",
    );
    expect(joinRefusalSentence("already-member")).toBe("You are already in that team.");
    expect(joinRefusalSentence("full")).toBe("That team is full.");
  });

  it("tells someone outside a team how to get into one, and the fact's length", () => {
    expect(teamFactRefusalSentence("not-in-a-team")).toBe(
      "You are not in a team. Start one or join one first (/team new, /team join).",
    );
    expect(teamFactRefusalSentence("text")).toBe(
      "Write the fact in 3 to 1000 characters (/team remember <fact>).",
    );
  });
});

describe("teamFactSentence", () => {
  it("says the whole team can recall what was added", () => {
    expect(teamFactSentence({ saved: true, redacted: [], teamName: "Platform" })).toBe(
      'Added to "Platform". Everyone in the team can recall it from now on.',
    );
  });

  it("mentions every credential it stripped", () => {
    expect(
      teamFactSentence({ saved: true, redacted: ["github-token", "jwt"], teamName: "Platform" }),
    ).toBe(
      'Added to "Platform". Everyone in the team can recall it from now on. I stripped github-token, jwt out of it first.',
    );
  });

  it("says a duplicate is already known rather than added", () => {
    expect(teamFactSentence({ saved: false, redacted: [], teamName: "Platform" })).toBe(
      '"Platform" already knows that.',
    );
  });
});

describe("joinedSentence", () => {
  it("says personal memory stays personal", () => {
    const text = joinedSentence("Platform");
    expect(text).toContain('Joined "Platform".');
    expect(text).toContain("Your own memory stays yours and is not shared.");
  });
});
