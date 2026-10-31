import { describe, expect, it } from "vitest";
import { admit, estimateTokens, judgeAdmitted, rankDistance, type Staleness } from "./admission.ts";

const c = (blobId: string, distance: number, text: string, namespace = "me") => ({
  blobId,
  namespace,
  text,
  distance,
});

describe("admit (F15, ADR-0074)", () => {
  it("ranks by distance, drops repeats and what the ledger says is no longer true", () => {
    const stale = new Map<string, Staleness>([
      ["old", "superseded"],
      ["guess", "disputed"],
    ]);
    const a = admit(
      [
        c("b", 0.4, "[profile] [by:@scout] [2026-10-30] Reply in Vietnamese."),
        c("a", 0.3, "Reply in   vietnamese"),
        c("old", 0.2, "SOURCE reef:brief · 3 calls", "sources"),
        c("guess", 0.25, "Works at Company C"),
        c("new", 0.5, "SOURCE reef:brief · 9 calls", "sources"),
      ],
      stale,
    );
    expect(a.admitted.map((x) => x.blobId)).toEqual(["a", "new"]);
    expect(a.rejected).toEqual([
      { blobId: "old", namespace: "sources", reason: "superseded" },
      { blobId: "guess", namespace: "me", reason: "disputed" },
      { blobId: "b", namespace: "me", reason: "duplicate" },
    ]);
  });

  it("caps per namespace, in total and by tokens", () => {
    const many = Array.from({ length: 6 }, (_, i) => c(`m${i}`, i / 10, `fact number ${i}`));
    expect(
      admit(many, new Map(), { maxCandidates: 10, perNamespace: 2, tokenBudget: 999 }).admitted,
    ).toHaveLength(2);
    expect(
      admit(many, new Map(), { maxCandidates: 3, perNamespace: 9, tokenBudget: 999 }).admitted,
    ).toHaveLength(3);
    const long = [c("big", 0.1, "x".repeat(400)), c("small", 0.2, "short fact")];
    const a = admit(long, new Map(), { maxCandidates: 10, perNamespace: 9, tokenBudget: 50 });
    // The budget skips what doesn't fit and still takes a smaller one after it.
    expect(a.admitted.map((x) => x.blobId)).toEqual(["small"]);
    expect(a.rejected).toEqual([{ blobId: "big", namespace: "me", reason: "over_budget" }]);
    expect(estimateTokens("abcd")).toBe(1);
  });

  it("keeps a memory the ledger knows nothing about", () => {
    expect(admit([c("x", 0.5, "anything")]).admitted).toHaveLength(1);
  });

  it("ranks the owner's memories first, 1.2× on similarity (ADR-0086)", () => {
    const owner = new Set(["mine"]);
    const pair = [
      c("agent", 0.3, "[episode] [by:@mcp:claude-code] [2026-10-31] Prefers short answers."),
      c("mine", 0.35, "[correction] [by:@scout] [2026-10-31] Prefers short answers"),
    ];
    // 1 − 0.65 × 1.2 = 0.22 < 0.3: the owner's copy is seen first, so the agent's is the repeat.
    const a = admit(pair, new Map(), undefined, owner);
    expect(a.admitted.map((x) => x.blobId)).toEqual(["mine"]);
    expect(a.rejected).toEqual([{ blobId: "agent", namespace: "me", reason: "duplicate" }]);
    // Without the boost, distance alone decides.
    expect(admit(pair).admitted.map((x) => x.blobId)).toEqual(["agent"]);
    // A cap drops the agent's line first; the cited distance doesn't change.
    const capped = admit(
      [c("agent", 0.3, "one fact"), c("mine", 0.35, "another fact")],
      new Map(),
      { maxCandidates: 1, perNamespace: 9, tokenBudget: 999 },
      owner,
    );
    expect(capped.admitted).toEqual([c("mine", 0.35, "another fact")]);
    // Far beyond the boost's reach: 1 − 0.4 × 1.2 = 0.52 is still behind 0.3.
    expect(
      admit([c("agent", 0.3, "near"), c("mine", 0.6, "far")], new Map(), undefined, owner)
        .admitted[0]?.blobId,
    ).toBe("agent");
    expect(rankDistance(1.2, true)).toBe(1.2);
  });
});

describe("judgeAdmitted", () => {
  const base = admit([c("a", 0.1, "relevant"), c("b", 0.2, "coffee")]);

  it("drops what the judge calls useless, and may keep nothing", async () => {
    const one = await judgeAdmitted("q", base, async () => ({ keep: ["a"], confidence: 0.9 }));
    expect(one.judged).toBe("filtered");
    expect(one.admitted.map((x) => x.blobId)).toEqual(["a"]);
    expect(one.rejected.at(-1)).toEqual({ blobId: "b", namespace: "me", reason: "not_useful" });
    const none = await judgeAdmitted("q", base, async () => ({ keep: [], confidence: 0.9 }));
    expect(none.admitted).toEqual([]);
  });

  it("fails open on a timeout, an error, an unknown id or low confidence", async () => {
    const slow = () => new Promise<never>(() => {});
    expect((await judgeAdmitted("q", base, slow, { timeoutMs: 10 })).judged).toBe("failed_open");
    const boom = async () => {
      throw new Error("model down");
    };
    expect((await judgeAdmitted("q", base, boom)).admitted).toHaveLength(2);
    const made = async () => ({ keep: ["zzz"], confidence: 0.99 });
    expect((await judgeAdmitted("q", base, made)).judged).toBe("failed_open");
    const unsure = async () => ({ keep: [], confidence: 0.2 });
    expect((await judgeAdmitted("q", base, unsure)).admitted).toHaveLength(2);
  });

  it("isn't called without a judge or candidates", async () => {
    expect((await judgeAdmitted("q", base, undefined)).judged).toBe("skipped");
    expect(
      (await judgeAdmitted("q", admit([]), async () => ({ keep: [], confidence: 1 }))).judged,
    ).toBe("skipped");
  });
});
