import { describe, expect, it } from "vitest";
import {
  assembleExport,
  type IndexRow,
  type RecalledLine,
  recoverText,
  renderMarkdown,
  sha256Hex,
} from "./export.ts";

const LINE_A = "[profile] [by:@mai] [#telegram] [2026-09-24] I only use pnpm";
const LINE_B = "[correction] [by:@mai] [#telegram] [2026-09-24] We moved from pnpm to bun";

function row(blobId: string | null, line: string, extra: Partial<IndexRow> = {}): IndexRow {
  return {
    blobId,
    type: line.slice(1, line.indexOf("]")),
    status: "stored",
    channel: "telegram",
    namespace: "hippo-guest:p1",
    accountId: "0xacc",
    createdAt: new Date("2026-09-24T10:00:00Z"),
    textSha256: sha256Hex(line),
    ...extra,
  };
}

/** A recall that returns `hits` for every query and counts how often it ran. */
function recallOf(hits: RecalledLine[] | (() => RecalledLine[])) {
  const calls: string[] = [];
  const recall = async ({ query }: { query: string }) => {
    calls.push(query);
    return typeof hits === "function" ? hits() : hits;
  };
  return { recall, calls };
}

describe("recoverText", () => {
  it("marks a line verified only when it hashes to what hippo recorded", async () => {
    const rows = [row("a", LINE_A), row("b", LINE_B)];
    const { recall } = recallOf([
      { blob_id: "a", text: LINE_A },
      { blob_id: "b", text: `${LINE_B} (tampered)` },
    ]);
    const got = await recoverText(recall, rows);
    expect(got.get("a")).toEqual({ line: LINE_A, verified: true });
    expect(got.get("b")?.verified).toBe(false);
  });

  it("stops recalling as soon as every blob is found", async () => {
    const { recall, calls } = recallOf([{ blob_id: "a", text: LINE_A }]);
    await recoverText(recall, [row("a", LINE_A)]);
    expect(calls).toHaveLength(1);
  });

  it("keeps going on other tags when the first recall misses some", async () => {
    let n = 0;
    const { recall, calls } = recallOf(() =>
      n++ === 0 ? [{ blob_id: "a", text: LINE_A }] : [{ blob_id: "b", text: LINE_B }],
    );
    const got = await recoverText(recall, [row("a", LINE_A), row("b", LINE_B)]);
    expect(got.size).toBe(2);
    expect(calls).toHaveLength(2);
  });

  it("survives a failed recall and uses the next one", async () => {
    let n = 0;
    const recall = async () => {
      if (n++ === 0) throw new Error("relayer said no");
      return [{ blob_id: "a", text: LINE_A }];
    };
    const got = await recoverText(recall, [row("a", LINE_A)]);
    expect(got.get("a")?.verified).toBe(true);
  });

  it("ignores blobs that are not this person's, and rows that never landed", async () => {
    const rows = [row("a", LINE_A), row(null, LINE_B, { status: "pending" })];
    const { recall } = recallOf([
      { blob_id: "a", text: LINE_A },
      { blob_id: "someone-else", text: LINE_B },
    ]);
    const got = await recoverText(recall, rows);
    expect([...got.keys()]).toEqual(["a"]);
  });
});

describe("assembleExport", () => {
  const rows = [
    row("a", LINE_A),
    row("b", LINE_B, { namespace: "hippo-team:t1" }),
    row("c", "[gotcha] [by:@mai] [2026-09-24] port 5433"),
    row(null, LINE_A, { status: "pending" }),
    row(null, LINE_A, { status: "failed" }),
  ];
  const file = assembleExport({
    now: new Date("2026-09-25T00:00:00Z"),
    account: { mode: "guest", accountId: "0xacc", owner: null },
    rows,
    recovered: new Map([
      ["a", { line: LINE_A, verified: true }],
      ["b", { line: LINE_B, verified: true }],
    ]),
    expiry: new Map([["a", "2027-04-01T00:00:00Z"]]),
    teamName: "Platform",
  });

  it("lists every stored memory and counts the rest", () => {
    expect(file.coverage).toEqual({
      memories: 3,
      withText: 2,
      verified: 2,
      stillWriting: 1,
      neverLanded: 1,
    });
    expect(file.memories.map((m) => m.blobId)).toEqual(["a", "b", "c"]);
  });

  it("gives the fact without the prefix, and keeps the exact line the hash covers", () => {
    const a = file.memories[0];
    expect(a?.text).toBe("I only use pnpm");
    expect(a?.line).toBe(LINE_A);
    expect(a?.sha256).toBe(sha256Hex(LINE_A));
    expect(a?.expiresAt).toBe("2027-04-01T00:00:00Z");
  });

  it("still lists a memory whose text did not come back", () => {
    const c = file.memories[2];
    expect(c?.text).toBeUndefined();
    expect(c?.verified).toBeNull();
    expect(c?.ciphertextUrl).toContain("c");
  });

  it("labels what the person gave a team, and says what that does not cover", () => {
    expect(file.memories.map((m) => m.scope)).toEqual(["own", "team", "own"]);
    const said = file.limits.join(" ");
    expect(said).toContain("hippo's own Walrus Memory account");
    // Teammates' facts are not theirs, and untracked older writes cannot be
    // listed; the file must not imply otherwise.
    expect(said).toContain("What teammates added is theirs and is not in this file");
    expect(said).toContain("nothing added before hippo began recording team writes");
  });

  it("keeps a hidden memory in the file, marked, because it is still the person's", () => {
    const withHidden = assembleExport({
      now: new Date("2026-09-25T00:00:00Z"),
      account: { mode: "guest", accountId: "0xacc", owner: null },
      rows: [row("a", LINE_A, { hiddenAt: new Date("2026-09-24T12:00:00Z") }), row("c", LINE_B)],
      recovered: new Map([["a", { line: LINE_A, verified: true }]]),
      expiry: new Map(),
    });
    expect(withHidden.memories.map((m) => m.hidden)).toEqual([true, false]);
    expect(renderMarkdown(withHidden)).toContain("· hidden");
  });

  it("never claims the reader can decrypt the blobs", () => {
    expect(file.limits.join(" ")).toContain("You cannot decrypt the ciphertext links yourself");
  });
});

describe("renderMarkdown", () => {
  it("shows unverified and unrecovered memories as such, and keeps unknown types", () => {
    const md = renderMarkdown(
      assembleExport({
        now: new Date("2026-09-25T00:00:00Z"),
        account: { mode: "owned", accountId: "0xacc", owner: "0xowner" },
        rows: [row("a", LINE_A), row("b", LINE_B), row("x", "[legacy] [2026-01-01] old")],
        recovered: new Map([["a", { line: LINE_A, verified: false }]]),
        expiry: new Map(),
      }),
    );
    expect(md).toContain("Held in **your** Walrus Memory account");
    expect(md).toContain("**did not verify**");
    expect(md).toContain("_text not recovered_");
    expect(md).toContain("## legacy");
  });
});
