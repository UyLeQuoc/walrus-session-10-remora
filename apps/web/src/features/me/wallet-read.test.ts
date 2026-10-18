import { describe, expect, it } from "vitest";
import type { Memory } from "./memory.ts";
import { readableRows, readMarkdown, sha256Text, walletReadRefusal } from "./wallet-read.ts";

const OWN = `0x${"aa".repeat(32)}`;
const HIPPO = `0x${"bb".repeat(32)}`;

function row(over: Partial<Memory>): Memory {
  return {
    id: "1",
    type: "profile",
    status: "stored",
    channel: "web",
    createdAt: "2026-10-01T00:00:00Z",
    blobId: "blob-1",
    expiresAt: null,
    ciphertextUrl: null,
    explorerUrl: null,
    accountId: OWN,
    ...over,
  };
}

describe("wallet read", () => {
  it("offers only stored memories sealed to the person's own account", () => {
    const rows = [
      row({ id: "own" }),
      row({ id: "guest-era", accountId: HIPPO }),
      row({ id: "writing", status: "pending" }),
      row({ id: "no-blob", blobId: null }),
    ];
    expect(readableRows(rows, OWN.toUpperCase()).map((r) => r.id)).toEqual(["own"]);
    expect(readableRows(rows, null)).toEqual([]);
  });

  it("asks a guest to own the memory and a wrong wallet to switch", () => {
    expect(walletReadRefusal({ owned: false, ownerWallet: null, connected: OWN })).toMatch(
      /\/connect/,
    );
    expect(walletReadRefusal({ owned: true, ownerWallet: OWN, connected: HIPPO })).toMatch(
      /does not own/,
    );
    expect(walletReadRefusal({ owned: true, ownerWallet: OWN, connected: OWN })).toBeNull();
  });

  it("hashes text the way hippo recorded it", async () => {
    expect(await sha256Text("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("writes a file that says what was read, and flags a line that does not match", () => {
    const md = readMarkdown(
      [
        {
          blobId: "b1",
          type: "profile",
          createdAt: "2026-10-01",
          text: "[profile] uses bun",
          verified: true,
        },
        {
          blobId: "b2",
          type: "gotcha",
          createdAt: "2026-10-01",
          text: "[gotcha] x",
          verified: false,
        },
        { blobId: "b3", type: "style", createdAt: "2026-10-01T00:00:00Z", error: "expired" },
      ],
      OWN,
      "2026-10-02",
    );
    expect(md).toContain("- [profile] uses bun\n");
    expect(md).toContain("does not match the hash");
    expect(md).toContain("could not be read: expired");
    expect(md).toContain("The relayer took no part");
  });
});
