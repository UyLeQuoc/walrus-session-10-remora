import { describe, expect, it } from "vitest";
import { HELP, PRIVACY } from "../copy.ts";
import {
  compareView,
  connectLinkView,
  exportWebView,
  forgetUsageView,
  helpView,
  hiddenMemoryView,
  memoryListView,
  privacyView,
  sentence,
  welcomeView,
  whoamiView,
} from "./command-views.ts";

describe("command views", () => {
  it("says how many memories the compared answer had, then the answer without them", () => {
    const view = compareView("npm is the default.", 2);
    expect(view.text).toBe(
      "Without the 2 memories my last answer used, I would have said:\n\nnpm is the default.",
    );
    expect(view.table.rows[0]?.cells).toEqual(["npm is the default."]);
    expect(compareView("x", 1).text).toMatch(/^Without the 1 memory my/);
  });

  it("keeps the channel sentence for whoami and puts the full id behind copy and open", () => {
    const view = whoamiView({
      mode: "owned",
      namespace: "hippo",
      accountId: `0x${"ab".repeat(32)}`,
      walletAddress: null,
      written: 3,
      relay: null,
    });
    expect(view.text).toContain("Mode: owned. This memory is in your own Walrus Memory account.");
    expect(view.text).toContain("Namespace: hippo");
    expect(view.text).toContain("https://suiscan.xyz/mainnet/object/0x");
    const account = view.table.rows.find((row) => row.cells[0] === "Account");
    expect(account?.copy).toBe(`0x${"ab".repeat(32)}`);
    expect(account?.href).toContain("suiscan.xyz");
    expect(account?.cells[1]).toBe(account?.copy);
    expect(view.table.rows.find((row) => row.cells[0] === "Namespace")?.copy).toBe("hippo");
    expect(view.table.rows.find((row) => row.cells[0] === "Namespace")?.href).toBeUndefined();
  });

  it("copies the full blob even though the cell and the channel text are short", () => {
    const blobId = `blob-${"0123456789".repeat(4)}`;
    const view = memoryListView([
      {
        type: "profile",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        blobId,
        hidden: true,
      },
    ]);
    expect(view.text).toContain(`blob ${blobId.slice(0, 10)}…`);
    expect(view.text).toContain("hidden");
    const row = view.table.rows[0];
    expect(row?.copy).toBe(blobId);
    expect(row?.href).toContain("walruscan.com");
    expect(row?.cells[0]).toContain("hidden");
    expect(row?.cells[2]).toBe(blobId);
  });

  it("turns help into command rows and leaves a one-line result as one row", () => {
    const help = helpView();
    expect(help.text).toBe(HELP);
    expect(help.table.columns).toEqual(["Command", "What it does"]);
    expect(help.table.rows.map((row) => row.cells[0])).toContain("/whoami");
    expect(help.table.rows.some((row) => row.copy || row.href)).toBe(false);
    const unknown = helpView(true);
    expect(unknown.text.startsWith("Unknown command.")).toBe(true);
    expect(unknown.table.lead).toMatch(/^Unknown command\./);

    const said = sentence("Memory on. I will remember what matters from now on.");
    expect(said.table.rows).toEqual([
      { cells: ["Memory on. I will remember what matters from now on."] },
    ]);
    expect(said.table.rows[0]?.copy).toBeUndefined();
  });

  it("gives privacy a row per line and a survey link only on the welcome paragraph that has one", () => {
    const privacy = privacyView();
    expect(privacy.text).toBe(PRIVACY);
    expect(privacy.table.rows.length).toBeGreaterThan(3);
    expect(privacy.table.rows.some((row) => row.cells[0]?.startsWith("•"))).toBe(false);
    expect(privacy.table.rows.some((row) => row.copy || row.href)).toBe(false);

    const plain = welcomeView();
    expect(plain.table.rows.some((row) => row.href)).toBe(false);
    const surveyed = welcomeView("https://example.com/survey");
    const linked = surveyed.table.rows.find((row) => row.href);
    expect(linked?.copy).toBe("https://example.com/survey");
    expect(linked?.href).toBe("https://example.com/survey");
  });

  it("opens connect and export pages, and copies the full blob after a forget", () => {
    const connect = connectLinkView("https://hippo.example/connect/abc");
    expect(connect.text).toContain("https://hippo.example/connect/abc");
    expect(connect.table.rows[0]).toMatchObject({
      copy: "https://hippo.example/connect/abc",
      href: "https://hippo.example/connect/abc",
    });
    const exported = exportWebView("2 memories.", "http://localhost:5173/me");
    expect(exported.table.rows[0]?.href).toBe("http://localhost:5173/me");
    const forgotten = hiddenMemoryView({
      hide: true,
      type: "profile",
      blobId: "blob-0123456789abcdef",
      owned: false,
    });
    expect(forgotten.text).toContain("blob blob-01234…");
    expect(forgotten.text).toContain("/memory unhide blob-01234");
    expect(forgotten.table.rows[0]?.copy).toBe("blob-0123456789abcdef");
    expect(forgotten.table.rows[0]?.href).toBeUndefined();
    expect(forgetUsageView().table.rows).toHaveLength(2);
  });
});
