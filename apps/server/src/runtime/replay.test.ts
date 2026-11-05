import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { and, createDb, eq, remoraEvents, remoraMemories, remoras } from "@remora/db";
import { loadEnv } from "@remora/memory";
import type { ReplayPlan, ReplayRun } from "@remora/schema";
import { afterAll, describe, expect, it } from "vitest";
import type { RuntimeDeps } from "./deps.ts";
import { differences, startReplay, totalsOf } from "./replay.ts";

const plan = (payees: string[], skips: ReplayPlan["skips"] = []): ReplayPlan => ({
  buys: payees.map((payee) => ({ payee, amount: "10000" })),
  skips,
  memories: [],
  total: String(payees.length * 10_000),
  answer: "",
  fromMemory: false,
});

describe("replay differences (A1)", () => {
  it("names what each later memory dropped, with its cited blobs", () => {
    const d = differences({
      none: plan(["reef:odds", "reef:price"]),
      t0: plan(["reef:odds", "reef:price"]),
      today: plan(
        ["reef:price"],
        [
          {
            payee: "reef:odds",
            reason: "skipped odds: your rule",
            kind: "rule",
            cites: ["b1", "b2"],
          },
        ],
      ),
    });
    expect(d).toEqual([
      {
        payee: "reef:odds",
        from: "t0",
        to: "today",
        reason: "skipped odds: your rule",
        cites: ["b1", "b2"],
      },
    ]);
  });

  it("totals planned services, spend and answers from memory per column", () => {
    const qs = [
      {
        question: "a",
        shapes: [],
        differences: [],
        plans: {
          none: plan(["reef:odds"]),
          t0: plan(["reef:odds"]),
          today: { ...plan([]), fromMemory: true },
        },
      },
    ] as unknown as ReplayRun["questions"];
    expect(totalsOf(qs)).toEqual({
      none: { services: 1, spend: "10000", fromMemory: 0 },
      t0: { services: 1, spend: "10000", fromMemory: 0 },
      today: { services: 0, spend: "0", fromMemory: 1 },
    });
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("a replay never pays, remembers or notifies (A1, Postgres)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x7e9${process.pid.toString(16)}`);
  const H = 3_600_000;
  const NOW = new Date();
  const T0 = new Date(NOW.getTime() - 20 * H);
  const AFTER = new Date(NOW.getTime() - 5 * H);
  let remembered = 0;
  let notified = 0;
  let paidCalls = 0;
  const reef = [
    {
      ref: "reef:odds",
      slug: "odds",
      name: "odds",
      description: "",
      path: "/odds",
      price: "10000",
      url: "https://m.test/odds",
      payTo: "0x1",
    },
    {
      ref: "reef:price",
      slug: "price",
      name: "price",
      description: "",
      path: "/price",
      price: "5000",
      url: "https://m.test/price",
      payTo: "0x1",
    },
    {
      ref: "reef:weather",
      slug: "weather",
      name: "weather",
      description: "",
      path: "/weather",
      price: "5000",
      url: "https://m.test/weather",
      payTo: "0x1",
    },
  ];
  const deps = {
    db,
    log: createLogger({}, () => {}),
    dailyTokens: 1_000_000,
    reef: () => reef,
    memory: {
      recall: async () => [
        {
          blobId: "blob-before-t0-xxxxxxxx",
          namespace: "sources",
          text: "SOURCE reef:odds · old",
          distance: 0.1,
        },
        {
          blobId: "blob-after-t0-xxxxxxxxx",
          namespace: "sources",
          text: "SOURCE reef:odds · new",
          distance: 0.2,
        },
      ],
      remember: async () => {
        remembered++;
        throw new Error("a replay must not write memory");
      },
    },
    facts: {
      list: async (_r: unknown, _ns: string[], o?: { asOf?: Date }) =>
        o?.asOf && o.asOf.getTime() < AFTER.getTime()
          ? []
          : [
              {
                subject: "reef:price",
                predicate: "track_record",
                value: "3 calls · 0 useful · 3 noise · no useful answers yet",
                blobIds: ["blob-after-t0-xxxxxxxxx"],
                observedAt: AFTER.toISOString(),
                hidden: false,
              },
            ],
      validity: async () => ({ stale: new Map(), current: [], owner: new Set() }),
    },
    brain: {
      answerModel: "test/model",
      answer: async (i: {
        pay?: (a: { payee: string; url: string; reason: string }) => Promise<unknown>;
      }) => {
        // The model asks for one more purchase: in a replay it's only recorded.
        if (i.pay) {
          paidCalls++;
          await i.pay({ payee: "reef:weather", url: "https://m.test/weather", reason: "x" });
        }
        return { text: "planned", tokens: 5 };
      },
    },
    notifier: {
      send: async () => {
        notified++;
        return "sent" as const;
      },
    },
  } as unknown as RuntimeDeps;

  afterAll(async () => {
    await db.delete(remoras).where(eq(remoras.ownerAddress, OWNER));
  });

  it("plans three columns, filters memory by T₀, and cites what changed", async () => {
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "scout",
        name: "Researcher",
        config: {
          persona: "x",
          rules: [
            {
              id: "rule-1",
              action: "skip",
              service: "reef:odds",
              when: { has: [], lacks: ["team"] },
              text: "Skip odds unless the question names a team",
              reason: "",
              cites: ["blob-rule-cite-1", "blob-rule-cite-2"],
              acceptedAt: new Date(NOW.getTime() - 4 * H).toISOString(),
            },
          ],
        },
        status: "active",
        address: normalizeSuiAddress("0xabc"),
        createdAt: new Date(NOW.getTime() - 48 * H),
      })
      .returning();
    if (!r) throw new Error("no remora");
    await db.insert(remoraMemories).values([
      {
        remoraId: r.id,
        namespace: "sources",
        blobId: "blob-before-t0-xxxxxxxx",
        status: "stored",
        createdAt: new Date(T0.getTime() - H),
      },
      {
        remoraId: r.id,
        namespace: "sources",
        blobId: "blob-after-t0-xxxxxxxxx",
        status: "stored",
        createdAt: AFTER,
      },
    ]);
    const { runId } = await startReplay(
      deps,
      r as never,
      { questions: ["what are the odds tonight, and the SUI price?"], t0: T0 },
      { wait: true, now: NOW },
    );
    const [e] = await db.select().from(remoraEvents).where(eq(remoraEvents.id, runId));
    const run = e?.payload as unknown as ReplayRun;
    expect(run.status).toBe("done");
    const q = run.questions[0];
    expect(q?.plans.none?.buys.map((b) => b.payee)).toEqual([
      "reef:odds",
      "reef:price",
      "reef:weather",
    ]);
    // At T₀ only the earlier blob was admitted, and no rule or note existed yet.
    expect(q?.plans.t0?.memories).toEqual(["blob-before-t0-xxxxxxxx"]);
    expect(q?.plans.t0?.buys.map((b) => b.payee)).toEqual([
      "reef:odds",
      "reef:price",
      "reef:weather",
    ]);
    // Today: the rule skips odds and the note skips price, each citing its blobs.
    expect(q?.plans.today?.buys.map((b) => b.payee)).toEqual(["reef:weather"]);
    expect(q?.differences.map((d) => [d.payee, d.from, d.to, d.cites])).toEqual([
      ["reef:odds", "t0", "today", ["blob-rule-cite-1", "blob-rule-cite-2"]],
      ["reef:price", "t0", "today", ["blob-after-t0-xxxxxxxxx"]],
    ]);
    expect(run.totals.none.services).toBe(3);
    expect(run.totals.today.services).toBe(1);
    // Nothing settled, nothing was remembered, nobody was told.
    expect(paidCalls).toBe(3);
    expect(remembered).toBe(0);
    expect(notified).toBe(0);
    const payments = await db
      .select()
      .from(remoraEvents)
      .where(and(eq(remoraEvents.remoraId, r.id), eq(remoraEvents.type, "payment")));
    expect(payments).toHaveLength(0);
    // A second and third run are fine; the fourth within the hour isn't.
    await startReplay(deps, r as never, { questions: ["odds?"], t0: T0 }, { wait: true, now: NOW });
    await startReplay(deps, r as never, { questions: ["odds?"], t0: T0 }, { wait: true, now: NOW });
    await expect(
      startReplay(deps, r as never, { questions: ["odds?"], t0: T0 }, { now: NOW }),
    ).rejects.toThrow(/Three replays an hour/);
  });
});
