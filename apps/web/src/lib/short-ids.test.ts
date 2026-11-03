import { describe, expect, it } from "vitest";
import { shortIds } from "./short-ids";

describe("shortIds", () => {
  it("shortens a long hex id and leaves short ones", () => {
    const id = "0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95e3c69e88434a5d6d";
    expect(shortIds(`Is the package ${id} safe?`)).toBe("Is the package 0xcc05…5d6d safe?");
    expect(shortIds("Is 0x2 safe?")).toBe("Is 0x2 safe?");
  });
});
