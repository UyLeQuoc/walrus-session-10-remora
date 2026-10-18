import { describe, expect, it } from "vitest";
import {
  createRefusalSentence,
  joinRefusalSentence,
  teamFactRefusalSentence,
} from "../identity/team-copy.ts";
import { createRefusal, joinRefusal, teamFactRefusal, teamSearchRefusal } from "./team-reply.ts";

describe("team refusals as HTTP replies", () => {
  it("maps creating a team", () => {
    expect(createRefusal("bad-name")).toEqual({
      status: 400,
      error: createRefusalSentence("bad-name"),
    });
    expect(createRefusal("already-in-a-team")).toEqual({
      status: 409,
      error: createRefusalSentence("already-in-a-team"),
    });
  });

  it("maps joining a team", () => {
    expect(joinRefusal("unknown")).toEqual({ status: 400, error: joinRefusalSentence("unknown") });
    expect(joinRefusal("expired")).toEqual({ status: 404, error: joinRefusalSentence("expired") });
    for (const reason of ["already-in-a-team", "already-member", "full"] as const) {
      expect(joinRefusal(reason)).toEqual({ status: 409, error: joinRefusalSentence(reason) });
    }
  });

  it("maps adding a fact", () => {
    expect(teamFactRefusal("text")).toEqual({
      status: 400,
      error: teamFactRefusalSentence("text"),
    });
    expect(teamFactRefusal("not-in-a-team")).toEqual({
      status: 409,
      error: teamFactRefusalSentence("not-in-a-team"),
    });
  });

  it("maps searching", () => {
    expect(teamSearchRefusal("not-in-a-team")).toEqual({
      status: 409,
      error: teamFactRefusalSentence("not-in-a-team"),
    });
    expect(teamSearchRefusal("unreachable")).toEqual({
      status: 502,
      error: "Walrus Memory could not be reached just now.",
    });
  });
});
