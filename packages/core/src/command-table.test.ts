import { describe, expect, it } from "vitest";
import {
  type CommandTable,
  isOpenableUrl,
  packCommandBody,
  presentCommandBody,
  proseTable,
  sanitizeTable,
  unpackCommandBody,
} from "./command-table.ts";

const table: CommandTable = {
  lead: "Mode: guest.",
  columns: ["Field", "Value"],
  rows: [
    { cells: ["Namespace", "hippo"], copy: "hippo" },
    {
      cells: ["Account", "0xabc"],
      copy: "0xabc",
      href: "https://suiscan.xyz/mainnet/object/0xabc",
    },
  ],
};

describe("command table envelope", () => {
  it("round-trips text and table", () => {
    const raw = packCommandBody("Mode: guest.", table);
    expect(unpackCommandBody(raw)).toEqual({ text: "Mode: guest.", table });
  });

  it("leaves an ordinary sentence alone", () => {
    expect(unpackCommandBody("Memory on.")).toEqual({ text: "Memory on." });
  });

  it("leaves json that is not an envelope alone", () => {
    expect(unpackCommandBody('{"ok":true}')).toEqual({ text: '{"ok":true}' });
  });

  it("drops a link that is not https and not localhost", () => {
    const cleaned = sanitizeTable({
      columns: ["Link"],
      rows: [{ cells: ["page"], copy: "http://example.com", href: "http://example.com" }],
    });
    expect(cleaned?.rows[0]).toEqual({ cells: ["page"], copy: "http://example.com" });
  });

  it("keeps localhost so the dev server's connect and /me links still open", () => {
    expect(isOpenableUrl("http://localhost:5173/me")).toBe(true);
    expect(isOpenableUrl("http://127.0.0.1:5173/connect/abc")).toBe(true);
    expect(isOpenableUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects a row whose cells do not match the columns", () => {
    expect(
      sanitizeTable({
        columns: ["Field", "Value"],
        rows: [{ cells: ["only one"] }],
      }),
    ).toBeUndefined();
  });

  it("shows an old stored command as one column and does not rewrite what the person typed", () => {
    expect(
      presentCommandBody("assistant", "command", "Memory on.\n\nNothing was deleted."),
    ).toEqual({
      text: "Memory on.\n\nNothing was deleted.",
      table: proseTable("Memory on.\n\nNothing was deleted."),
    });
    expect(presentCommandBody("user", "command", "/whoami")).toEqual({ text: "/whoami" });
    const packed = packCommandBody("Mode: guest.", table);
    expect(presentCommandBody("assistant", "command", packed)).toEqual({
      text: "Mode: guest.",
      table,
    });
  });
});
