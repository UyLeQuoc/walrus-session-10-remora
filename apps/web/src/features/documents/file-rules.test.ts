import { describe, expect, it } from "vitest";
import { fileKind, fileRefusal, fundsRefusal, MIN_SUI_MIST, ownerRefusal } from "./file-rules.ts";

const WALLET = `0x${"ab".repeat(32)}`;

describe("file rules", () => {
  it("reads text and Markdown files up to 100 KB", () => {
    expect(fileKind("notes.MD")).toBe("text/markdown");
    expect(fileKind("todo.txt")).toBe("text/plain");
    expect(fileKind("scan.pdf")).toBeNull();
    expect(fileRefusal({ name: "notes.md", size: 2048 })).toBeNull();
    expect(fileRefusal({ name: "scan.pdf", size: 10 })).toMatch(/\.txt and \.md/);
    expect(fileRefusal({ name: "big.md", size: 200 * 1024 })).toMatch(/over 100 KB/);
  });

  it("asks a guest to own their memory, and a wrong wallet to switch", () => {
    expect(ownerRefusal({ owned: false, ownerWallet: null, connected: WALLET })).toMatch(
      /\/connect/,
    );
    expect(ownerRefusal({ owned: true, ownerWallet: WALLET, connected: null })).toMatch(
      /Connect the wallet/,
    );
    expect(
      ownerRefusal({ owned: true, ownerWallet: WALLET, connected: `0x${"cd".repeat(32)}` }),
    ).toMatch(/Another wallet/);
    expect(
      ownerRefusal({ owned: true, ownerWallet: WALLET, connected: WALLET.toUpperCase() }),
    ).toBeNull();
  });

  it("names the missing coin before any signature", () => {
    expect(fundsRefusal({ sui: 0n, wal: 10n, walNeeded: 1n })).toMatch(/SUI/);
    expect(fundsRefusal({ sui: MIN_SUI_MIST, wal: 0n, walNeeded: 1n })).toMatch(/WAL/);
    expect(fundsRefusal({ sui: MIN_SUI_MIST, wal: 1n, walNeeded: 1n })).toBeNull();
  });
});
