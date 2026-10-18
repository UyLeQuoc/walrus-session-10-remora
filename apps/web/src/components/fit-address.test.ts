import { describe, expect, it } from "vitest";
import { fitAddress, isFlexibleId } from "@/components/fit-address";

const address = `0x${"ab".repeat(32)}`;

describe("fitAddress", () => {
  it("keeps a string that fits", () => {
    expect(fitAddress("hippo", 10)).toBe("hippo");
    expect(fitAddress(address, address.length)).toBe(address);
  });

  it("cuts the middle and keeps both ends, wider boxes keeping more of each", () => {
    const narrow = fitAddress(address, 10);
    expect(narrow).toBe(`0xab...${address.slice(-3)}`);
    expect(narrow).toBe("0xab...bab");
    const wider = fitAddress(address, 17);
    expect(wider.startsWith("0xababa")).toBe(true);
    expect(wider.endsWith(address.slice(-7))).toBe(true);
    expect(wider).toContain("...");
    expect(wider.length).toBeGreaterThan(narrow.length);
  });

  it("does not drop the 0x when the box is tinier than the floor", () => {
    const cut = fitAddress(address, 4);
    expect(cut.startsWith("0xab")).toBe(true);
    expect(cut.endsWith(address.slice(-2))).toBe(true);
    expect(cut).toContain("...");
  });

  it("uses the same middle cut for a long id that is not an address", () => {
    const blob = `blob${"0123456789".repeat(4)}`;
    const cut = fitAddress(blob, 10);
    expect(cut.startsWith("blob")).toBe(true);
    expect(cut.endsWith(blob.slice(-3))).toBe(true);
    expect(isFlexibleId(blob)).toBe(true);
    expect(isFlexibleId("hippo")).toBe(false);
    expect(isFlexibleId("https://suiscan.xyz/mainnet/object/0xabc")).toBe(false);
    expect(isFlexibleId("writing to Walrus…")).toBe(false);
  });
});
