import type { PlannerRule } from "@remora/schema";
import { ruleText, shapesOf } from "@remora/schema";
import { describe, expect, it } from "vitest";
import { applyMemory, parseTrackRecord, rulesAt, type TrackRecord } from "./plan-memory.ts";

const buy = (ref: string) => ({ entry: { ref }, url: `https://x/${ref}`, reason: ref });
const rule = (over: Partial<PlannerRule>): PlannerRule => ({
  id: "r1",
  action: "skip",
  service: "reef:odds",
  when: { has: [], lacks: ["team"] },
  text: "Skip odds unless the question names a team",
  reason: "",
  cites: ["blobA", "blobB"],
  acceptedAt: "2026-11-06T01:00:00.000Z",
  ...over,
});
const record = (over: Partial<TrackRecord>): TrackRecord => ({
  service: "reef:price",
  calls: 4,
  useful: 0,
  noise: 3,
  blobIds: ["blobS2", "blobS1"],
  since: "2026-11-05",
  ...over,
});

describe("question shapes (A1/A2)", () => {
  it("reads a question the same way every time", () => {
    expect(shapesOf("odds for Arsenal vs Chelsea tonight")).toContain("team");
    expect(shapesOf("what are the odds tonight?")).not.toContain("team");
    expect(shapesOf("is 0xabc123def safe?")).toEqual(["address"]);
    expect(shapesOf("SUI price now")).toEqual(["token"]);
    expect(shapesOf("health of https://github.com/MystenLabs/walrus-docs")).toEqual(["repo"]);
  });

  it("writes a rule's line from its structure", () => {
    expect(ruleText(rule({}))).toBe("Skip odds unless the question names a team");
    expect(ruleText(rule({ action: "ask", when: { has: [], lacks: [] } }))).toBe(
      "Ask before buying odds",
    );
  });
});

describe("what memory changes in a plan (A1/A2)", () => {
  it("a rule skips a planned purchase when it applies, and cites its memories", () => {
    const out = applyMemory({
      buys: [buy("reef:odds"), buy("reef:price")],
      question: "what are the odds tonight, and the SUI price?",
      rules: [rule({})],
      records: [],
    });
    expect(out.keep.map((b) => b.entry.ref)).toEqual(["reef:price"]);
    expect(out.skips[0]).toMatchObject({
      payee: "reef:odds",
      kind: "rule",
      cites: ["blobA", "blobB"],
    });
    expect(out.skips[0]?.reason).toMatch(/your rule from Nov 6/);
  });

  it("the same rule doesn't apply when the question names a team", () => {
    const out = applyMemory({
      buys: [buy("reef:odds")],
      question: "odds for Arsenal vs Chelsea?",
      rules: [rule({})],
      records: [],
    });
    expect(out.keep).toHaveLength(1);
    expect(out.skips).toHaveLength(0);
  });

  it("its notes skip a service rated mostly noise, citing the note's blobs", () => {
    const out = applyMemory({
      buys: [buy("reef:price")],
      question: "SUI price?",
      rules: [],
      records: [record({})],
    });
    expect(out.keep).toHaveLength(0);
    expect(out.skips[0]).toMatchObject({ kind: "memory", cites: ["blobS2", "blobS1"] });
    expect(out.skips[0]?.reason).toMatch(/0 of 3 rated answers/);
  });

  it("keeps a service with too few ratings or enough useful ones", () => {
    for (const rec of [record({ noise: 2 }), record({ useful: 2, noise: 3 })]) {
      const out = applyMemory({
        buys: [buy("reef:price")],
        question: "SUI price?",
        rules: [],
        records: [rec],
      });
      expect(out.keep).toHaveLength(1);
    }
  });

  it("ask turns a purchase into a question, and prefer only reorders", () => {
    const ask = applyMemory({
      buys: [buy("reef:odds")],
      question: "odds?",
      rules: [rule({ action: "ask", when: { has: [], lacks: [] } })],
      records: [],
    });
    expect(ask.keep).toHaveLength(0);
    expect(ask.skips[0]?.reason).toMatch(/ask first/);
    const prefer = applyMemory({
      buys: [buy("reef:sui-risk"), buy("reef:wallet")],
      question: "wallet 0xabc123",
      rules: [
        rule({ action: "prefer", service: "reef:wallet", when: { has: [], lacks: [] } }),
        rule({ id: "r2", action: "prefer", service: "reef:github", when: { has: [], lacks: [] } }),
      ],
      records: [],
    });
    expect(prefer.keep.map((b) => b.entry.ref)).toEqual(["reef:wallet", "reef:sui-risk"]);
  });

  it("reads rules as they stood at T₀", () => {
    const config = {
      rules: [rule({}), rule({ id: "r2", acceptedAt: "2026-11-07T00:00:00.000Z" })],
    };
    expect(rulesAt(config).map((x) => x.id)).toEqual(["r1", "r2"]);
    expect(rulesAt(config, new Date("2026-11-06T12:00:00Z")).map((x) => x.id)).toEqual(["r1"]);
    expect(rulesAt(config, new Date("2026-11-05T00:00:00Z"))).toEqual([]);
  });

  it("parses a track record", () => {
    expect(parseTrackRecord("4 calls · 1 useful · 3 noise · $0.040 per useful answer")).toEqual({
      calls: 4,
      useful: 1,
      noise: 3,
    });
    expect(parseTrackRecord("Hanoi")).toBeNull();
  });
});
