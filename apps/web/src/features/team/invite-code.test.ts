import { describe, expect, it } from "vitest";
import { INVITE_ALPHABET, isInviteCode, joinCommand, normalizeInviteCode } from "./invite-code";

describe("normalizeInviteCode", () => {
  it("trims, uppercases and drops spaces and dashes", () => {
    expect(normalizeInviteCode("  k7q-x2m ")).toBe("K7QX2M");
    expect(normalizeInviteCode("k7q x2m")).toBe("K7QX2M");
  });

  it("accepts the whole join command the invite copies", () => {
    expect(normalizeInviteCode(joinCommand("K7QX2M"))).toBe("K7QX2M");
    expect(normalizeInviteCode("/TEAM JOIN k7qx2m")).toBe("K7QX2M");
  });
});

describe("isInviteCode", () => {
  it("takes six characters from the invite alphabet", () => {
    expect(isInviteCode("K7QX2M")).toBe(true);
    expect(isInviteCode(INVITE_ALPHABET.slice(0, 6))).toBe(true);
  });

  it("refuses the wrong length", () => {
    expect(isInviteCode("K7QX2")).toBe(false);
    expect(isInviteCode("K7QX2MM")).toBe(false);
    expect(isInviteCode("")).toBe(false);
  });

  it("refuses characters a code never contains", () => {
    expect(isInviteCode("K7QX2O")).toBe(false);
    expect(isInviteCode("K7QX2I")).toBe(false);
    expect(isInviteCode("K7QX21")).toBe(false);
    expect(isInviteCode("K7QX20")).toBe(false);
    expect(isInviteCode("k7qx2m")).toBe(false);
  });
});

describe("joinCommand", () => {
  it("is the command every channel understands", () => {
    expect(joinCommand("K7QX2M")).toBe("/team join K7QX2M");
  });
});
