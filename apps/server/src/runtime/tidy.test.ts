/** A3 (ADR-0147): which notes a tidy merges, and which notes or rules it asks about. */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import {
  and,
  approvals,
  createDb,
  eq,
  isNotNull,
  memoryFacts,
  remoraMemories,
  remoras,
} from "@remora/db";
import { loadEnv, type MemoryType } from "@remora/memory";
import type { PlannerRule } from "@remora/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RuntimeDeps } from "./deps.ts";
import { createFactLedger, type FactView, withFacts } from "./facts.ts";
import type { RemoraMemory } from "./memory.ts";
import { trackRecords } from "./plan-memory.ts";
import type { Remora, RemoraService } from "./remoras.ts";
import {
  groupForMerge,
  type NoteVersion,
  noteConflicts,
  noteVersions,
  overlap,
  resolveConflict,
  ruleConflicts,
  tidy,
  tidyView,
  verdictOf,
} from "./tidy.ts";

const NOW = new Date("2026-11-07T12:00:00Z");
const day = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
let n = 0;
const v = (
  service: string,
  value: string,
  ago: number,
  over: Partial<NoteVersion> = {},
): NoteVersion => ({
  factId: `f${++n}`,
  service,
  value,
  at: day(ago),
  status: "superseded",
  blobIds: [`blob-${n}`],
  ...over,
});
const rule = (over: Partial<PlannerRule>): PlannerRule => ({
  id: "r1",
  action: "skip",
  service: "reef:odds",
  when: { has: [], lacks: [] },
  text: "Skip odds",
  reason: "",
  cites: [],
  acceptedAt: "2026-11-06T01:00:00.000Z",
  ...over,
});

describe("verdicts (A3)", () => {
  it("reads a record as mostly useful, mostly noise, or mixed", () => {
    expect(verdictOf("3 calls · 0 useful · 3 noise · no useful answers yet")).toBe("noise");
    expect(verdictOf("4 calls · 3 useful · 1 noise · $0.01 per useful answer")).toBe("useful");
    expect(verdictOf("2 calls · 1 useful · 1 noise")).toBe("mixed");
    expect(verdictOf("2 calls · 0 useful · 0 noise")).toBeNull();
    expect(verdictOf("Hanoi")).toBeNull();
  });

  it("reads the ledger's track records, without hidden blobs or someone else's word", () => {
    const fact = (over: Partial<FactView>) =>
      ({
        id: "x",
        subject: "reef:odds",
        predicate: "track_record",
        value: "3 calls · 0 useful · 3 noise",
        validFrom: null,
        observedAt: day(1),
        status: "active",
        blobIds: ["b1", "b2"],
        ...over,
      }) as FactView;
    const out = noteVersions(
      [
        fact({}),
        fact({ id: "y", value: "1 calls · 1 useful · 0 noise · SOURCE: pack 0xabc" }),
        fact({ id: "z", subject: "owner", predicate: "reply_language" }),
      ],
      new Set(["b1"]),
    );
    expect(out).toEqual([
      {
        factId: "x",
        service: "reef:odds",
        value: "3 calls · 0 useful · 3 noise",
        at: day(1),
        status: "active",
        blobIds: ["b2"],
      },
    ]);
  });
});

describe("consolidate (A3)", () => {
  it("merges the newest run of 3+ notes with the same verdict, ending at the record in effect", () => {
    const versions = [
      v("reef:odds", "1 calls · 1 useful · 0 noise", 6),
      v("reef:odds", "2 calls · 1 useful · 1 noise", 5),
      v("reef:odds", "3 calls · 1 useful · 2 noise", 4),
      v("reef:odds", "4 calls · 1 useful · 3 noise", 3),
      v("reef:odds", "5 calls · 1 useful · 4 noise", 2, { status: "active" }),
    ];
    const [g, ...rest] = groupForMerge(versions);
    expect(rest).toEqual([]);
    expect(g?.service).toBe("reef:odds");
    expect(g?.verdict).toBe("noise");
    expect(g?.notes.map((x) => x.value.split(" · ")[0])).toEqual(["3 calls", "4 calls", "5 calls"]);
    expect(g?.blobIds).toHaveLength(3);
  });

  it("doesn't merge fewer than 3, a mixed record, or a record no longer in effect", () => {
    const two = [
      v("reef:a", "1 calls · 0 useful · 1 noise", 3),
      v("reef:a", "2 calls · 0 useful · 2 noise", 2, { status: "active" }),
    ];
    const mixed = [
      v("reef:b", "1 calls · 1 useful · 0 noise", 4),
      v("reef:b", "2 calls · 2 useful · 0 noise", 3),
      v("reef:b", "4 calls · 2 useful · 2 noise", 2, { status: "active" }),
    ];
    const closed = [
      v("reef:c", "1 calls · 0 useful · 1 noise", 4),
      v("reef:c", "2 calls · 0 useful · 2 noise", 3),
      v("reef:c", "3 calls · 0 useful · 3 noise", 2),
    ];
    expect(groupForMerge([...two, ...mixed, ...closed])).toEqual([]);
  });

  it("counts visible blobs: a note already merged doesn't count again", () => {
    const versions = [
      v("reef:odds", "3 calls · 0 useful · 3 noise", 4, { blobIds: [] }),
      v("reef:odds", "4 calls · 0 useful · 4 noise", 3),
      v("reef:odds", "5 calls · 0 useful · 5 noise", 2, { status: "active" }),
    ];
    expect(groupForMerge(versions)).toEqual([]);
    expect(groupForMerge(versions, 2)).toHaveLength(1);
  });
});

describe("conflicts (A3)", () => {
  it("a useful note and a noise note on one service within 7 days disagree", () => {
    const versions = [
      v("reef:brief", "1 calls · 1 useful · 0 noise", 5),
      v("reef:brief", "2 calls · 1 useful · 1 noise", 3),
      v("reef:brief", "3 calls · 1 useful · 2 noise", 1, { status: "active" }),
    ];
    const [c, ...rest] = noteConflicts(versions, NOW);
    expect(rest).toEqual([]);
    expect(c).toMatchObject({ what: "notes", service: "reef:brief" });
    expect(c?.a.value).toBe("1 calls · 1 useful · 0 noise");
    expect(c?.b.value).toBe("3 calls · 1 useful · 2 noise");
    expect(c?.a.label).toMatch(/Brief was mostly useful|was mostly useful/);
    expect(c?.key).toBe(`notes:reef:brief:${c?.a.blobIds?.[0]}:${c?.b.blobIds?.[0]}`);
  });

  it("not when one of them is older than 7 days, or they agree", () => {
    const old = [
      v("reef:x", "1 calls · 1 useful · 0 noise", 9),
      v("reef:x", "3 calls · 1 useful · 2 noise", 1, { status: "active" }),
    ];
    const agree = [
      v("reef:y", "1 calls · 0 useful · 1 noise", 3),
      v("reef:y", "2 calls · 0 useful · 2 noise", 1, { status: "active" }),
    ];
    expect(noteConflicts([...old, ...agree], NOW)).toEqual([]);
  });

  it("a skip (or ask) and a prefer for one service disagree when both can apply", () => {
    expect(
      overlap({ when: { has: [], lacks: ["team"] } }, { when: { has: ["team"], lacks: [] } }),
    ).toBe(false);
    expect(overlap({ when: { has: [], lacks: [] } }, { when: { has: ["token"], lacks: [] } })).toBe(
      true,
    );
    const rules = [
      rule({ id: "skip-odds" }),
      rule({ id: "prefer-odds", action: "prefer", text: "Prefer odds" }),
      rule({ id: "prefer-price", action: "prefer", service: "reef:price", text: "Prefer price" }),
      rule({
        id: "skip-weather",
        service: "reef:weather",
        when: { has: [], lacks: ["city"] },
        text: "Skip weather unless a city",
      }),
      rule({
        id: "prefer-weather",
        action: "prefer",
        service: "reef:weather",
        when: { has: ["city"], lacks: [] },
        text: "Prefer weather for a city",
      }),
    ];
    const out = ruleConflicts(rules);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      what: "rules",
      service: "reef:odds",
      key: "rules:prefer-odds:skip-odds",
      a: { ruleId: "skip-odds" },
      b: { ruleId: "prefer-odds" },
    });
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("a tidy merges, hides, asks, and the owner settles (A3, Postgres)", () => {
  const db = createDb(local as string);
  const log = createLogger({}, () => {});
  const OWNER = normalizeSuiAddress(`0x71d${process.pid.toString(16)}`);
  const NS = ["me", "sources", "feedback", "receipts"];
  let clock = Date.now() - 3 * 86_400_000;
  const ledger = createFactLedger(db, { log, now: () => new Date(clock) });
  let n = 0;
  const memory: RemoraMemory = {
    recall: async () => [],
    async remember(r, ns, type: MemoryType, _text, o) {
      const blobId = `tidy-blob-${process.pid}-${++n}`;
      const [row] = await db
        .insert(remoraMemories)
        .values({
          remoraId: r.id,
          namespace: ns,
          type,
          blobId,
          status: "stored",
          ...(o?.replaces ? { corrects: o.replaces } : {}),
        })
        .returning({ id: remoraMemories.id });
      return { saved: true, note: "", ...(row ? { indexId: row.id } : {}) };
    },
  };
  const mem = withFacts(memory, ledger);
  const sent: string[] = [];
  const deps = {
    db,
    log,
    facts: ledger,
    memory: mem,
    webBase: "https://remora.test",
    notifier: {
      send: async (_o: string, x: { text: string }) => {
        sent.push(x.text);
        return "sent" as const;
      },
    },
  } as unknown as RuntimeDeps;
  const service = { config: () => ({ namespaces: NS }) } as unknown as RemoraService;
  let r: Remora;
  const record = async (service: string, useful: number, noise: number) => {
    clock += 3_600_000;
    await mem.remember(
      r,
      "sources",
      "source",
      `SOURCE ${service} · ${useful + noise} calls · ${useful} useful · ${noise} noise · as_of 2026-11-07`,
      { dedupe: false },
    );
    await ledger.idle();
  };

  beforeAll(async () => {
    const [row] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "scout",
        name: "Researcher",
        status: "active",
        address: normalizeSuiAddress(`0x71e${process.pid.toString(16)}`),
        config: {
          namespaces: NS,
          rules: [
            rule({ id: "skip-odds", text: "Skip odds" }),
            rule({ id: "prefer-odds", action: "prefer", text: "Prefer odds" }),
          ],
        },
      })
      .returning();
    if (!row) throw new Error("no remora");
    r = row;
    // Price: rated noise three times. Brief: useful, then noise twice.
    for (const k of [1, 2, 3]) await record("reef:price", 0, k);
    await record("reef:brief", 1, 0);
    await record("reef:brief", 1, 1);
    await record("reef:brief", 1, 2);
  });
  afterAll(async () => {
    await db.delete(memoryFacts).where(eq(memoryFacts.remoraId, r.id));
    await db.delete(remoras).where(eq(remoras.ownerAddress, OWNER));
  });

  it("merges three notes into one, hides them, and the record still holds", async () => {
    const out = await tidy(deps, r, { trigger: "owner", now: new Date(clock) });
    expect(out.merged.map((m) => [m.service, m.verdict, m.blobIds.length])).toEqual([
      ["reef:price", "noise", 3],
    ]);
    expect(out.conflicts).toHaveLength(2);
    expect(out.note).toMatch(/merged 3 notes on .* into one each; 2 conflicts to settle/);
    const hidden = await db
      .select({ blobId: remoraMemories.blobId })
      .from(remoraMemories)
      .where(and(eq(remoraMemories.remoraId, r.id), isNotNull(remoraMemories.hiddenAt)));
    expect(hidden.map((h) => h.blobId).sort()).toEqual([...out.hidden].sort());
    // The planner still reads the record: it now rests on the tidy note too.
    const [price] = (await trackRecords(deps, r)).filter((x) => x.service === "reef:price");
    expect(price).toMatchObject({ useful: 0, noise: 3 });
    expect(price?.blobIds.some((b) => !out.hidden.includes(b))).toBe(true);
    expect(sent[0]).toMatch(/Which one holds\?/);

    const view = await tidyView(deps, r);
    expect(view.runs[0]?.merged[0]?.noteBlobId).toMatch(/^tidy-blob-/);
    expect(view.conflicts.map((c) => [c.what, c.service]).sort()).toEqual([
      ["notes", "reef:brief"],
      ["rules", "reef:odds"],
    ]);
    // Asked once: a second tidy merges nothing new and asks nothing again.
    const again = await tidy(deps, r, { trigger: "owner", now: new Date(clock) });
    expect(again.merged).toEqual([]);
    expect(again.conflicts).toEqual([]);
  });

  it("the owner picks: the other note is corrected, the other rule removed", async () => {
    const view = await tidyView(deps, r);
    const notes = view.conflicts.find((c) => c.what === "notes");
    const rules = view.conflicts.find((c) => c.what === "rules");
    const out = await resolveConflict(deps, service, OWNER, notes?.id ?? "", "b");
    expect(out.corrected).toBe(notes?.a.blobIds?.[0]);
    const [fix] = await db
      .select()
      .from(remoraMemories)
      .where(
        and(eq(remoraMemories.remoraId, r.id), eq(remoraMemories.corrects, out.corrected ?? "")),
      );
    expect(fix?.type).toBe("correction");
    await resolveConflict(deps, service, OWNER, rules?.id ?? "", "a");
    const [after] = await db.select().from(remoras).where(eq(remoras.id, r.id));
    const kept = (after?.config as { rules?: PlannerRule[] } | undefined)?.rules ?? [];
    expect(kept.map((x) => x.id)).toEqual(["skip-odds"]);
    const decided = await db
      .select({ status: approvals.status })
      .from(approvals)
      .where(and(eq(approvals.remoraId, r.id), eq(approvals.kind, "rule_conflict")));
    expect(decided.map((d) => d.status)).toEqual(["approved", "approved"]);
    await expect(resolveConflict(deps, service, OWNER, rules?.id ?? "", "b")).rejects.toThrow(
      /Already approved/,
    );
  });
});
