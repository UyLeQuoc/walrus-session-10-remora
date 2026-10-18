import { describe, expect, it } from "vitest";
import { inheritedGuestIds, meIdentity } from "./predicates.ts";

describe("meIdentity", () => {
  it("does not treat a session header that resolves to nobody as identified", () => {
    // This used to mint a new person on every request.
    expect(meIdentity(false, undefined)).toBe("none");
  });

  it("prefers a real session, and falls back to the guest id", () => {
    expect(meIdentity(true, "guest-1")).toBe("session");
    expect(meIdentity(false, "guest-1")).toBe("guest");
  });
});

describe("inheritedGuestIds", () => {
  it("finds the guest namespace a merge left behind", () => {
    const got = inheritedGuestIds("winner", [
      "hippo",
      "hippo-guest:winner",
      "hippo-guest:loser",
      "hippo-guest:loser",
      "hippo-team:t1",
    ]);
    expect(got).toEqual(["loser"]);
  });

  it("finds nothing for someone who was never merged", () => {
    expect(inheritedGuestIds("p", ["hippo-guest:p", "hippo"])).toEqual([]);
  });
});
