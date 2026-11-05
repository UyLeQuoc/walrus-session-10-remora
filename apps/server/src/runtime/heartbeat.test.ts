import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { approvals, createDb, eq, remoraEvents, remoras } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { afterAll, describe, expect, it } from "vitest";
import type { RuntimeDeps } from "./deps.ts";
import {
  acceptRule,
  declineRule,
  draftRule,
  HEARTBEAT,
  heartbeat,
  narrowsOnly,
  numbersFrom,
  type Outcome,
} from "./heartbeat.ts";

const at = new Date("2026-11-06T00:00:00Z");
const o = (kind: Outcome["kind"], payee: string, shapes: Outcome["shapes"] = []): Outcome => ({
  kind,
  payee,
  shapes,
  at,
});

describe("rule proposals from outcomes (A2)", () => {
  it("3 noise ratings for one service propose skipping it unless a shape its useful answers had", () => {
    const d = draftRule(
      [
        o("noise", "reef:odds"),
        o("noise", "reef:odds"),
        o("noise", "reef:odds", ["token"]),
        o("useful", "reef:odds", ["team"]),
      ],
      [],
    );
    expect(d?.rule).toEqual({
      action: "skip",
      service: "reef:odds",
      when: { has: [], lacks: ["team"] },
    });
    expect(d?.count).toBe(3);
  });

  it("2 noise ratings aren't enough; with no useful shape it proposes asking first", () => {
    expect(draftRule([o("noise", "reef:odds"), o("noise", "reef:odds")], [])).toBeNull();
    const d = draftRule(
      [o("noise", "reef:odds"), o("noise", "reef:odds"), o("noise", "reef:odds")],
      [],
    );
    expect(d?.rule.action).toBe("ask");
  });

  it("2 declined payments to one payee propose asking first; an existing rule covers it", () => {
    const outs = [o("declined", "reef:wallet"), o("declined", "reef:wallet")];
    expect(draftRule(outs, [])?.rule).toMatchObject({ action: "ask", service: "reef:wallet" });
    expect(
      draftRule(outs, [
        {
          id: "x",
          action: "skip",
          service: "reef:wallet",
          when: { has: [], lacks: [] },
          text: "t",
          reason: "",
          cites: [],
          acceptedAt: at.toISOString(),
        },
      ]),
    ).toBeNull();
  });

  it("the model's reason may only restate numbers it was given", () => {
    const src = [
      "You rated Odds's answers noise 3 times since Nov 5.",
      "5 calls · 2 useful · 3 noise",
    ];
    expect(numbersFrom("Odds was noise 3 times in 5 calls since Nov 5.", src)).toBe(true);
    expect(numbersFrom("Odds gave 2 useful answers out of 25 calls.", src)).toBe(false);
  });

  it("a rule can only narrow: a prefer that adds a service is refused", () => {
    expect(narrowsOnly({ action: "skip", service: "reef:new" }, ["reef:odds"])).toBe(true);
    expect(narrowsOnly({ action: "prefer", service: "reef:odds" }, ["reef:odds"])).toBe(true);
    expect(narrowsOnly({ action: "prefer", service: "reef:new" }, ["reef:odds"])).toBe(false);
    expect(
      narrowsOnly({ action: "prefer", service: "reef:odds", over: "reef:new" }, ["reef:odds"]),
    ).toBe(false);
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("rule proposals end to end in Postgres (A2)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x7a1${process.pid.toString(16)}`);
  const written: string[] = [];
  const deps = {
    db,
    log: createLogger({}, () => {}),
    webBase: "http://web.test",
    reef: () => [{ ref: "reef:odds" }, { ref: "reef:price" }],
    brain: {
      answerModel: "test/model",
      answer: async () => ({ text: "You rated odds noise three times without a team.", tokens: 3 }),
    },
    facts: {
      list: async () => [
        {
          subject: "reef:odds",
          predicate: "track_record",
          value: "3 calls · 0 useful · 3 noise",
          blobIds: ["blob-odds-3"],
          recordedAt: "2026-11-06T01:00:00.000Z",
          hidden: false,
        },
        {
          subject: "reef:odds",
          predicate: "track_record",
          value: "2 calls · 0 useful · 2 noise",
          blobIds: ["blob-odds-2"],
          recordedAt: "2026-11-05T23:00:00.000Z",
          hidden: false,
        },
      ],
    },
    memory: {
      remember: async (_r: unknown, _ns: string, _t: string, text: string) => {
        written.push(text);
        return { saved: true, note: "", indexId: undefined };
      },
    },
    notifier: { send: async () => "sent" as const },
  } as unknown as RuntimeDeps;

  afterAll(async () => {
    await db.delete(remoras).where(eq(remoras.ownerAddress, OWNER));
  });

  it("proposes with cited memories, a tap accepts it, and a decline waits 7 days", async () => {
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "scout",
        name: "Researcher",
        config: { persona: "x", budget: { perPaymentCap: "20000" } },
        status: "active",
        address: normalizeSuiAddress("0xabc"),
        discId: "0xd15c",
      })
      .returning();
    if (!r) throw new Error("no remora");
    for (const q of ["odds tonight?", "any odds?", "odds for the weekend?"])
      await db.insert(remoraEvents).values({
        remoraId: r.id,
        network: "testnet",
        type: "answer",
        summary: q,
        feedback: "noise",
        payload: { question: q, paidPayees: ["reef:odds"] },
      });
    await db.insert(remoraEvents).values({
      remoraId: r.id,
      network: "testnet",
      type: "answer",
      summary: "odds Arsenal vs Chelsea",
      feedback: "useful",
      payload: { question: "odds for Arsenal vs Chelsea?", paidPayees: ["reef:odds"] },
    });
    const first = await heartbeat(deps, r as never);
    expect(first).toHaveProperty("proposalId");
    const id = (first as { proposalId: string }).proposalId;
    const [a] = await db.select().from(approvals).where(eq(approvals.id, id));
    expect(a?.payload).toMatchObject({
      kind: "planner_rule",
      rule: {
        action: "skip",
        service: "reef:odds",
        text: "Skip odds unless the question names a team",
      },
      cites: [{ blobId: "blob-odds-3" }, { blobId: "blob-odds-2" }],
    });
    // One open at a time.
    expect(await heartbeat(deps, r as never)).toEqual({
      skipped: "a rule proposal is already open",
    });

    // Declined: remembered, and the same rule waits 7 days.
    await declineRule(deps, OWNER, id);
    expect(written.at(-1)).toMatch(/\[rule\] declined: Skip odds/);
    expect(await heartbeat(deps, r as never)).toEqual({
      skipped: "you declined this rule in the last 7 days",
    });
    const later = new Date(Date.now() + HEARTBEAT.declineWaitMs + 60_000);
    const again = await heartbeat(deps, r as never, later);
    expect(again).toHaveProperty("proposalId");

    // Accepted with a tap: into config.rules, written as a [rule] memory citing the outcomes.
    const { rule } = await acceptRule(
      deps,
      {} as never,
      OWNER,
      (again as { proposalId: string }).proposalId,
    );
    expect(rule.cites).toEqual(["blob-odds-3", "blob-odds-2"]);
    const [row] = await db.select().from(remoras).where(eq(remoras.id, r.id));
    expect((row?.config as { rules?: unknown[] } | undefined)?.rules).toHaveLength(1);
    expect(written.at(-1)).toMatch(
      /^\[rule\] Skip odds unless the question names a team · accepted/,
    );
    // A rule now covers odds: nothing more to propose.
    expect(await heartbeat(deps, row as never, later)).toEqual({
      skipped: "nothing happened often enough to propose a rule",
    });
  });
});
