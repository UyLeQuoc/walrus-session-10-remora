import { describe, expect, it } from "vitest";
import {
  currentAt,
  type Fact,
  type FactInput,
  parseSourceLine,
  reconcile,
  sameValue,
  slotKey,
} from "./facts.ts";

/** The ledger's fold, in memory: every candidate reconciled against its slot, in write order. */
function fold(candidates: FactInput[], now = Date.parse("2026-10-31T12:00:00Z")) {
  const facts: Fact[] = [];
  let n = 0;
  for (const c of candidates) {
    const slot = facts.filter((f) => slotKey(f) === slotKey(c) && f.status !== "retracted");
    const d = reconcile(c, slot, now);
    const id = `f${++n}`;
    const latest = Math.max(0, ...slot.map((f) => f.version));
    if (d.action === "create") facts.push({ ...c, id, status: "active", version: latest + 1 });
    if (d.action === "dispute") facts.push({ ...c, id, status: "disputed", version: latest + 1 });
    if (d.action === "history")
      facts.push({ ...c, id, status: "superseded", validUntil: d.validUntil, version: latest + 1 });
    if (d.action === "supersede") {
      const old = facts.find((f) => f.id === d.factId) as Fact;
      old.status = "superseded";
      old.validUntil = d.validUntil;
      const promoted = d.promote ? facts.find((f) => f.id === d.promote) : undefined;
      if (promoted) promoted.status = "active";
      else facts.push({ ...c, id, status: "active", version: latest + 1 });
    }
  }
  return facts;
}

const owner = (
  predicate: string,
  value: string,
  observedAt: string,
  extra: Partial<FactInput> = {},
): FactInput => ({
  subject: "owner",
  predicate,
  value,
  cardinality: "one",
  observedAt,
  assertedBy: "owner",
  verification: "explicit",
  confidence: 1,
  ...extra,
});

const NOW = Date.parse("2026-10-31T12:00:00Z");

describe("reconcile (F15, ADR-0074)", () => {
  it("the owner switching from tea to coffee supersedes, and tea stays as history", () => {
    const facts = fold([
      owner("drink", "tea", "2026-10-01T08:00:00Z"),
      owner("drink", "coffee", "2026-10-20T08:00:00Z"),
    ]);
    expect(facts.map((f) => [f.value, f.status])).toEqual([
      ["tea", "superseded"],
      ["coffee", "active"],
    ]);
    expect(currentAt(facts, NOW).map((f) => f.value)).toEqual(["coffee"]);
    expect(currentAt(facts, Date.parse("2026-10-10T00:00:00Z")).map((f) => f.value)).toEqual([
      "tea",
    ]);
  });

  it("a move next month takes effect next month, not when it was said", () => {
    const facts = fold([
      owner("employer", "Company A", "2026-01-05T00:00:00Z", { validFrom: "2026-01-01" }),
      owner("employer", "Company B", "2026-10-31T09:00:00Z", { validFrom: "2026-12-01" }),
    ]);
    expect(currentAt(facts, NOW).map((f) => f.value)).toEqual(["Company A"]);
    expect(currentAt(facts, Date.parse("2026-12-15T00:00:00Z")).map((f) => f.value)).toEqual([
      "Company B",
    ]);
  });

  it("an extractor's guess can't overwrite what the owner said: it's disputed", () => {
    const facts = fold([
      owner("employer", "Company A", "2026-10-01T00:00:00Z"),
      owner("employer", "Company C", "2026-10-30T00:00:00Z", {
        assertedBy: "extractor",
        verification: "inferred",
        confidence: 0.7,
      }),
    ]);
    expect(facts.map((f) => [f.value, f.status])).toEqual([
      ["Company A", "active"],
      ["Company C", "disputed"],
    ]);
    expect(currentAt(facts, NOW).map((f) => f.value)).toEqual(["Company A"]);
  });

  it("an agent can't overwrite the owner either, until the owner says the same thing", () => {
    const facts = fold([
      owner("reply_language", "Vietnamese", "2026-10-01T00:00:00Z"),
      owner("reply_language", "English", "2026-10-29T00:00:00Z", { assertedBy: "agent" }),
      owner("reply_language", "english.", "2026-10-30T00:00:00Z"),
    ]);
    // The owner repeated the disputed value: that row is promoted, not duplicated.
    expect(facts.map((f) => [f.value, f.status])).toEqual([
      ["Vietnamese", "superseded"],
      ["English", "active"],
    ]);
  });

  it("an agent restating its disputed claim adds evidence, nothing else", () => {
    const facts = fold([
      owner("reply_language", "Vietnamese", "2026-10-01T00:00:00Z"),
      owner("reply_language", "English", "2026-10-29T00:00:00Z", { assertedBy: "agent" }),
      owner("reply_language", "English", "2026-10-30T00:00:00Z", { assertedBy: "agent" }),
    ]);
    expect(facts.map((f) => [f.value, f.status])).toEqual([
      ["Vietnamese", "active"],
      ["English", "disputed"],
    ]);
  });

  it("the same value again extends, whatever the case or the full stop", () => {
    const slot = fold([owner("timezone", "Asia/Ho_Chi_Minh", "2026-10-01T00:00:00Z")]);
    expect(
      reconcile(owner("timezone", "asia/ho_chi_minh.", "2026-10-31T00:00:00Z"), slot, NOW),
    ).toEqual({ action: "extend", factId: "f1" });
  });

  it("a many-valued slot keeps every value", () => {
    const facts = fold([
      owner("project", "Remora", "2026-10-01T00:00:00Z", { cardinality: "many" }),
      owner("project", "Kitty", "2026-10-02T00:00:00Z", { cardinality: "many" }),
    ]);
    expect(currentAt(facts, NOW).map((f) => f.value)).toEqual(["Remora", "Kitty"]);
  });

  it("“in March I worked at A”, told after B since June, is history and answers as_of March", () => {
    const facts = fold([
      owner("employer", "Company B", "2026-06-02T00:00:00Z", { validFrom: "2026-06-01" }),
      owner("employer", "Company A", "2026-10-31T00:00:00Z", { validFrom: "2026-03-01" }),
    ]);
    expect(facts.map((f) => [f.value, f.status, f.validUntil ?? null])).toEqual([
      ["Company B", "active", null],
      ["Company A", "superseded", "2026-06-01"],
    ]);
    expect(currentAt(facts, Date.parse("2026-03-15T00:00:00Z")).map((f) => f.value)).toEqual([
      "Company A",
    ]);
    expect(currentAt(facts, NOW).map((f) => f.value)).toEqual(["Company B"]);
  });

  it("a closed interval in the past is history even from a weaker source", () => {
    const facts = fold([
      owner("city", "Hanoi", "2026-10-01T00:00:00Z", { validFrom: "2026-01-01" }),
      owner("city", "Da Nang", "2026-10-02T00:00:00Z", {
        assertedBy: "agent",
        validFrom: "2025-01-01",
        validUntil: "2025-12-31",
      }),
    ]);
    expect(facts.map((f) => [f.value, f.status])).toEqual([
      ["Hanoi", "active"],
      ["Da Nang", "superseded"],
    ]);
  });

  it("a stronger source that took effect earlier means the weaker fact never held", () => {
    const facts = fold([
      owner("city", "Saigon", "2026-10-30T00:00:00Z", { assertedBy: "agent" }),
      owner("city", "Hanoi", "2026-10-31T00:00:00Z", { validFrom: "2025-01-01" }),
    ]);
    expect(facts.map((f) => [f.value, f.status])).toEqual([
      ["Saigon", "superseded"],
      ["Hanoi", "active"],
    ]);
    expect(currentAt(facts, Date.parse("2026-10-30T12:00:00Z")).map((f) => f.value)).toEqual([
      "Hanoi",
    ]);
  });

  it("an expired fact gives way to the next one, whoever says it", () => {
    const facts = fold(
      [
        owner("quiet_hours", "23:00–07:00", "2026-10-01T00:00:00Z", {
          expiresAt: "2026-10-31T00:00:00Z",
        }),
      ],
      Date.parse("2026-10-01T01:00:00Z"),
    );
    expect(
      reconcile(
        owner("quiet_hours", "none", "2026-10-31T10:00:00Z", { assertedBy: "agent" }),
        facts,
        NOW,
      ),
    ).toEqual({ action: "supersede", factId: "f1", validUntil: "2026-10-31T00:00:00Z" });
  });

  it("skips what isn't a fact: guesses, secrets, bad dates, already expired, ended before begun", () => {
    const at = "2026-10-31T00:00:00Z";
    const skip = (c: FactInput) => {
      const d = reconcile(c, [], NOW);
      return d.action === "skip" ? d.reason : d.action;
    };
    expect(skip(owner("x", "y", at, { confidence: 0.3 }))).toBe("low_confidence");
    expect(skip(owner("api_key", "sk-or-abcdefghijklmnopqrstuv", at))).toBe("secret");
    expect(skip(owner("note", "[REDACTED:jwt]", at))).toBe("secret");
    expect(skip(owner("x", "y", "yesterday"))).toBe("bad_time");
    expect(skip(owner("x", "y", at, { expiresAt: "2026-10-01T00:00:00Z" }))).toBe("expired");
    expect(skip(owner("x", "y", at, { validFrom: "2026-10-10", validUntil: "2026-10-01" }))).toBe(
      "ended_before_it_began",
    );
    expect(skip(owner("  ", "y", at))).toBe("empty");
    expect(skip(owner("x", "y".repeat(301), at))).toBe("too_long");
  });

  it("is deterministic: the same slot and candidate give the same decision", () => {
    const slot = fold([owner("drink", "tea", "2026-10-01T00:00:00Z")]);
    const c = owner("drink", "coffee", "2026-10-02T00:00:00Z", { assertedBy: "agent" });
    expect(reconcile(c, slot, NOW)).toEqual(reconcile(c, [...slot].reverse(), NOW));
  });
});

describe("slots and values", () => {
  it("normalises slot keys and keeps a Reef ref whole", () => {
    expect(slotKey({ subject: "Owner", predicate: "Reply Language" })).toBe("owner.reply_language");
    expect(
      slotKey({ subject: "reef:brief", predicate: "track_record", qualifier: "VN pages" }),
    ).toBe("reef:brief.track_record[vn_pages]");
    expect(sameValue("Tiếng Việt", "tiếng việt.")).toBe(true);
  });

  it("parses Remora's own SOURCE lines, and only those", () => {
    const at = "2026-10-31T00:00:00Z";
    expect(
      parseSourceLine(
        "SOURCE reef:brief · 9 calls · 2 useful · 7 noise · $0.010 per useful answer · as_of 2026-10-31",
        at,
      ),
    ).toMatchObject({
      subject: "reef:brief",
      predicate: "track_record",
      value: "9 calls · 2 useful · 7 noise · $0.010 per useful answer",
      cardinality: "one",
    });
    expect(parseSourceLine("brief was useless today", at)).toBeNull();
  });

  it("a tidy note reads as the record it restates, not a new value (A3, ADR-0147)", () => {
    const at = "2026-11-07T00:00:00Z";
    const tidy = parseSourceLine(
      "SOURCE reef:brief · 9 calls · 2 useful · 7 noise · $0.010 per useful answer · as_of 2026-11-07 · SOURCE: tidy of blobA, blobB, blobC",
      at,
    );
    expect(tidy?.value).toBe("9 calls · 2 useful · 7 noise · $0.010 per useful answer");
    // Any other provenance stays in the value: only a tidy note restates a record.
    expect(
      parseSourceLine("SOURCE reef:brief · 3 calls · SOURCE: import notes.md 0a1b2c3d", at)?.value,
    ).toBe("3 calls · SOURCE: import notes.md 0a1b2c3d");
  });

  it("a newer track record from the runtime supersedes the last one", () => {
    const at = (d: string) => `2026-10-${d}T00:00:00Z`;
    const line = (n: number, d: string) => ({
      ...(parseSourceLine(`SOURCE reef:brief · ${n} calls · as_of 2026-10-${d}`, at(d)) as Omit<
        FactInput,
        "assertedBy"
      >),
      assertedBy: "runtime" as const,
    });
    const facts = fold([line(3, "20"), line(9, "30")]);
    expect(currentAt(facts, NOW).map((f) => f.value)).toEqual(["9 calls"]);
  });
});
