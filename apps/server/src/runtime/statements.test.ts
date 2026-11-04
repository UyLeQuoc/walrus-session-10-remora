import { randomBytes, randomUUID } from "node:crypto";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger, type SuiNetwork } from "@remora/chain";
import {
  createDb,
  discEvents,
  eq,
  inArray,
  ownerSettings,
  receipts,
  remoraEvents,
  remoras,
} from "@remora/db";
import { loadEnv } from "@remora/memory";
import { Statement } from "@remora/schema";
import { MemoryKeyStore, RemoraSigner } from "@remora/signer";
import { Hono } from "hono";
import { afterAll, describe, expect, it } from "vitest";
import { createNetworks } from "../money/networks.ts";
import type { RuntimeDeps } from "./deps.ts";
import { mountLedger, type OwnerApp } from "./ledger-routes.ts";
import { createRemoraService, RemoraError } from "./remoras.ts";
import {
  CSV_COLUMNS,
  csvCell,
  dayIn,
  isFailure,
  type Ledger,
  type LedgerPayment,
  loadLedger,
  statementCsv,
  statementOf,
} from "./statements.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const names = new Map([
  [A, "Researcher"],
  [B, "Keeper"],
]);

const pay = (at: string, amount: number, o: Partial<LedgerPayment> = {}): LedgerPayment => ({
  at: new Date(at),
  remoraId: A,
  payee: "reef:weather",
  payTo: "0x3e",
  amount: BigInt(amount),
  digest: `D${at}${amount}`,
  intent: "ab".repeat(32),
  memo: null,
  paidBy: "remora",
  matched: true,
  receiptId: null,
  ...o,
});
const ledger = (payments: LedgerPayment[], extra: Partial<Ledger> = {}): Ledger => ({
  payments,
  failures: [],
  hikes: [],
  ...extra,
});
const statement = (l: Ledger, month = "2026-11", timezone = "UTC") =>
  statementOf({ month, timezone, network: "testnet", ledger: l, names });

describe("statement (E6)", () => {
  it("totals the month per day, remora and payee, and splits remora from owner-approved", () => {
    const s = statement(
      ledger([
        pay("2026-10-31T23:00:00Z", 5_000),
        pay("2026-11-02T08:00:00Z", 5_000),
        pay("2026-11-02T09:00:00Z", 10_000, { payee: "reef:brief" }),
        pay("2026-11-03T09:00:00Z", 2_000_000, {
          remoraId: B,
          payee: "reef:odds",
          paidBy: "owner",
          matched: null,
        }),
      ]),
    );
    expect(Statement.parse(s)).toBeTruthy();
    expect(s).toMatchObject({ total: "2015000", payments: 3, byOwner: "2000000" });
    expect(s.byRemoras).toBe("15000");
    expect(s.days).toHaveLength(30);
    expect(s.days[1]).toEqual({ day: "2026-11-02", amount: "15000", payments: 2 });
    expect(s.remoras.map((r) => [r.name, r.amount])).toEqual([
      ["Keeper", "2000000"],
      ["Researcher", "15000"],
    ]);
    expect(s.payees.map((p) => [p.label, p.payments])).toEqual([
      ["Odds", 1],
      ["Brief", 1],
      ["Weather", 1],
    ]);
    // Weather was first paid in October, so it's not new this month.
    expect(s.payees.find((p) => p.label === "Weather")?.firstPaid).toBe("2026-10-31T23:00:00.000Z");
  });

  it("buckets days in the owner's timezone", () => {
    // 23:00 UTC on Oct 31 is Nov 1 in Hanoi.
    const s = statement(
      ledger([pay("2026-10-31T23:00:00Z", 5_000)]),
      "2026-11",
      "Asia/Ho_Chi_Minh",
    );
    expect(s.days[0]).toEqual({ day: "2026-11-01", amount: "5000", payments: 1 });
    expect(statement(ledger([pay("2026-10-31T23:00:00Z", 5_000)])).payments).toBe(0);
    expect(dayIn("America/Los_Angeles")(new Date("2026-11-01T05:00:00Z"))).toBe("2026-10-31");
  });

  it("flags a day over 3× the 14-day median, but not a small one", () => {
    const usual = Array.from({ length: 14 }, (_, i) =>
      pay(`2026-10-${String(18 + i).padStart(2, "0")}T10:00:00Z`, 40_000),
    );
    const s = statement(
      ledger([
        ...usual,
        pay("2026-11-01T10:00:00Z", 100_000),
        pay("2026-11-01T11:00:00Z", 30_000),
        pay("2026-11-02T10:00:00Z", 110_000),
      ]),
    );
    const spikes = s.flags.filter((f) => f.kind === "spike");
    expect(spikes).toHaveLength(1);
    expect(spikes[0]).toMatchObject({ day: "2026-11-01", amount: "130000", baseline: "40000" });
    expect(spikes[0]?.at).toBe("2026-11-01T11:00:00.000Z");
    // With no history the median is 0: 0.05 is too small to flag, 0.10 is a spike.
    expect(statement(ledger([pay("2026-11-05T10:00:00Z", 50_000)])).flags).not.toContainEqual(
      expect.objectContaining({ kind: "spike" }),
    );
    expect(
      statement(ledger([pay("2026-11-05T10:00:00Z", 100_000)])).flags.map((f) => f.kind),
    ).toContain("spike");
  });

  it("flags a payee's first payment and a price change of 20% or more", () => {
    const s = statement(
      ledger([
        pay("2026-10-30T10:00:00Z", 5_000),
        pay("2026-11-01T10:00:00Z", 5_500),
        pay("2026-11-02T10:00:00Z", 6_000),
        pay("2026-11-03T10:00:00Z", 10_000, { payee: "reef:brief" }),
        // People get what each errand costs: a contact's amounts never count as a price change.
        pay("2026-11-04T10:00:00Z", 2_000_000, { payee: "contact:linh", payTo: "0x99" }),
        pay("2026-11-05T10:00:00Z", 100_000, { payee: "contact:linh", payTo: "0x99" }),
      ]),
    );
    expect(s.flags.filter((f) => f.kind === "new_payee").map((f) => f.payee)).toEqual([
      "Brief",
      "contact:linh",
    ]);
    const changes = s.flags.filter((f) => f.kind === "price_change");
    expect(changes).toHaveLength(0);
    const hike = statement(
      ledger([pay("2026-10-30T10:00:00Z", 10_000), pay("2026-11-01T10:00:00Z", 15_000)]),
    ).flags.find((f) => f.kind === "price_change");
    expect(hike).toMatchObject({ payee: "Weather", amount: "15000", baseline: "10000" });
    expect(hike?.summary).toBe("Weather charged 0.015 USDC, up 50% from 0.01.");
    const drop = statement(
      ledger([pay("2026-11-01T10:00:00Z", 10_000), pay("2026-11-02T10:00:00Z", 8_000)]),
    ).flags.find((f) => f.kind === "price_change");
    expect(drop?.summary).toMatch(/down 20% from 0.01/);
  });

  it("surfaces a Keeper's price_hike events", () => {
    const s = statement(
      ledger([], {
        hikes: [
          {
            at: new Date("2026-11-04T10:00:00Z"),
            remoraId: B,
            summary: "price hike: Weather 0.010 → 0.015",
            payee: "reef:weather",
            amount: 15_000n,
            previous: 10_000n,
          },
        ],
      }),
    );
    expect(s.flags).toEqual([
      expect.objectContaining({
        kind: "price_hike",
        remora: "Keeper",
        payee: "Weather",
        amount: "15000",
        baseline: "10000",
        summary: "price hike: Weather 0.010 → 0.015",
      }),
    ]);
  });

  it("flags three failed payments in a row from one remora, not three spread out", () => {
    const fail = (at: string, remoraId = A, code = "x402.unsettled") => ({
      at: new Date(at),
      remoraId,
      code,
    });
    const s = statement(
      ledger([pay("2026-11-02T10:30:00Z", 5_000)], {
        failures: [
          fail("2026-11-02T10:00:00Z"),
          fail("2026-11-02T10:10:00Z"),
          fail("2026-11-02T11:00:00Z"),
          fail("2026-11-02T11:10:00Z", B),
          fail("2026-11-02T11:20:00Z"),
          fail("2026-11-02T11:30:00Z", A, "allowance.over_window_limit"),
          fail("2026-11-02T11:40:00Z"),
        ],
      }),
    );
    const runs = s.flags.filter((f) => f.kind === "failed_run");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      remora: "Researcher",
      count: 4,
      at: "2026-11-02T11:30:00.000Z",
    });
    expect(runs[0]?.summary).toBe("Researcher: 4 payments in a row failed (x402.unsettled).");
    expect(s.failed).toBe(7);
  });

  it("counts refusals as refusals and everything else as a failure", () => {
    for (const code of [
      "sonar.blocked",
      "sale.depth",
      "sale.self",
      "over_limit",
      "remora.not_active",
    ])
      expect(isFailure(code)).toBe(false);
    for (const code of [
      "x402.unsettled",
      "allowance.revoked",
      "disc.over_per_payment_cap",
      "funds.insufficient_address_balance",
      "rate_limited",
      "unknown",
    ])
      expect(isFailure(code)).toBe(true);
  });

  it("refuses a month that isn't YYYY-MM", () => {
    expect(() => statement(ledger([]), "2026-13")).toThrow(RemoraError);
  });
});

describe("statement CSV (E6)", () => {
  it("has one row per payment with the verify link, and escapes what a spreadsheet would run", () => {
    const csv = statementCsv(
      [
        pay("2026-11-02T08:00:00Z", 5_000, {
          digest: "8PqTz4m9uWJ3xVhK1nR2cY7bL5dA6sE0fG3hJ9kM2pQ",
        }),
        pay("2026-11-03T09:00:00Z", 2_000_000, {
          remoraId: B,
          payee: "reef:odds",
          paidBy: "owner",
          matched: null,
          intent: null,
          memo: '=HYPERLINK("x"), lunch',
        }),
        pay("2026-11-04T09:00:00Z", 7_000, { digest: null, receiptId: A, matched: false }),
      ],
      names,
      "https://getremora.vercel.app/",
    );
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe(CSV_COLUMNS.join(","));
    expect(lines[1]).toBe(
      [
        "2026-11-02T08:00:00.000Z",
        "Researcher",
        "Weather",
        "0x3e",
        "0.005000",
        "5000",
        "8PqTz4m9uWJ3xVhK1nR2cY7bL5dA6sE0fG3hJ9kM2pQ",
        "ab".repeat(32),
        "",
        "https://getremora.vercel.app/verify/8PqTz4m9uWJ3xVhK1nR2cY7bL5dA6sE0fG3hJ9kM2pQ",
        "remora",
        "yes",
      ].join(","),
    );
    expect(lines[2]).toContain(`"'=HYPERLINK(""x""), lunch"`);
    expect(lines[2]).toMatch(/,owner-approved,n\/a$/);
    expect(lines[2]).toContain(",2.000000,2000000,");
    expect(lines[3]).toContain(`https://getremora.vercel.app/verify/${A}`);
    expect(lines[3]).toMatch(/,remora,no$/);
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("plain")).toBe("plain");
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("statement from the database (E6)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x5a${randomBytes(8).toString("hex")}`);
  const PAYTO = normalizeSuiAddress("0x3e");
  const reef = [
    { ref: "reef:weather", payTo: PAYTO },
    { ref: "reef:odds", payTo: PAYTO },
  ];
  const ids: string[] = [];
  const digests: string[] = [];
  const digest = () => {
    const d = `St${randomBytes(18).toString("hex")}`.slice(0, 40);
    digests.push(d);
    return d;
  };
  afterAll(async () => {
    if (digests.length) {
      await db.delete(receipts).where(inArray(receipts.txDigest, digests));
      await db.delete(discEvents).where(inArray(discEvents.txDigest, digests));
    }
    if (ids.length) await db.delete(remoras).where(inArray(remoras.id, ids));
    await db.delete(ownerSettings).where(eq(ownerSettings.ownerAddress, OWNER));
  });

  async function remora(name: string) {
    const id = randomUUID();
    ids.push(id);
    await db.insert(remoras).values({
      id,
      ownerAddress: OWNER,
      network: "testnet",
      template: "scout",
      name,
      config: { name },
      status: "active",
      address: normalizeSuiAddress(`0x${randomBytes(8).toString("hex")}`),
    });
    return id;
  }
  async function wake(remoraId: string, txDigest: string, amount: string, at: Date) {
    const [w] = await db
      .insert(receipts)
      .values({
        network: "testnet",
        remoraId,
        agent: "0x1",
        wake: {
          intent: {
            decision: { action: "pay", payee: "reef:weather", payTo: PAYTO, amount, reason: "r" },
          },
        },
        intentHash: randomBytes(32).toString("hex"),
        txDigest,
        createdAt: at,
      })
      .returning();
    if (!w) throw new Error("no receipt");
    return w;
  }

  it("reads each payment once, whoever recorded it, and matches it to the chain", async () => {
    const researcher = await remora("Researcher");
    const keeper = await remora("Keeper");
    const at = (d: string) => new Date(`2026-11-${d}Z`);
    // 1. A remora's payment: its event and its Wake share a digest; the indexer saw its Paid.
    const d1 = digest();
    const w1 = await wake(researcher, d1, "5000", at("02T08:00:00"));
    await db.insert(remoraEvents).values({
      remoraId: researcher,
      network: "testnet",
      type: "payment",
      summary: "Paid 5000 to Weather",
      payload: { payee: "reef:weather", amount: "5000", digest: d1 },
      receiptId: w1.id,
      createdAt: at("02T08:00:01"),
    });
    await db.insert(discEvents).values({
      network: "testnet",
      checkpoint: 1n,
      txDigest: d1,
      eventSeq: 0,
      type: "Paid",
      discId: "0xd1",
      payload: { amount: "5000", payee: PAYTO, intent: w1.intentHash },
    });
    // 2. A Wake that settled though the service then answered an error: no payment event.
    const d2 = digest();
    await wake(researcher, d2, "5000", at("02T09:00:00"));
    // 3. The owner approved one over the limit from their own wallet; its answer Wake shares the digest.
    const d3 = digest();
    await db.insert(receipts).values({
      network: "testnet",
      remoraId: keeper,
      agent: "0x1",
      wake: { intent: { decision: { action: "answer", reason: "approved" } } },
      intentHash: randomBytes(32).toString("hex"),
      txDigest: d3,
      createdAt: at("03T10:00:00"),
    });
    await db.insert(remoraEvents).values({
      remoraId: keeper,
      network: "testnet",
      type: "payment",
      summary: "You paid 2000000 to Odds (approved)",
      payload: { payee: "reef:odds", amount: "2000000", digest: d3, approvedBy: "owner" },
      createdAt: at("03T10:00:00"),
    });
    // 4. An unexplained Paid (ADR-0077), and failures and a refusal.
    const d4 = digest();
    await db.insert(remoraEvents).values([
      {
        remoraId: keeper,
        network: "testnet",
        type: "action",
        summary: "A payment from Keeper's spending limit has no decision behind it",
        payload: { unexplained: true, digest: d4, amount: "7000", payTo: "0xa77ac" },
        createdAt: at("04T10:00:00"),
      },
      ...[1, 2, 3].map((m) => ({
        remoraId: keeper,
        network: "testnet" as const,
        type: "blocked",
        summary: "Didn't pay",
        payload: { code: "x402.unsettled" },
        createdAt: at(`05T10:0${m}:00`),
      })),
      {
        remoraId: keeper,
        network: "testnet",
        type: "blocked",
        summary: "The safety check stopped a payment",
        payload: { code: "sonar.blocked" },
        createdAt: at("05T10:05:00"),
      },
    ]);

    const l = await loadLedger(db, [researcher, keeper], "testnet", new Date("2026-12-02Z"), reef);
    expect(l.payments.map((p) => [p.digest, p.amount, p.paidBy, p.matched])).toEqual([
      [d1, 5_000n, "remora", true],
      [d3, 2_000_000n, "owner", null],
      [d2, 5_000n, "remora", false],
      [d4, 7_000n, "remora", false],
    ]);
    expect(l.payments[0]).toMatchObject({ intent: w1.intentHash, payTo: PAYTO, receiptId: w1.id });
    expect(l.payments[1]?.payTo).toBe(PAYTO);
    expect(l.failures).toHaveLength(3);

    // Through the routes, as the owner on testnet, in their timezone.
    await db.insert(ownerSettings).values({ ownerAddress: OWNER, timezone: "Asia/Ho_Chi_Minh" });
    const service = createRemoraService({
      db,
      networks: createNetworks({}),
      signer: new RemoraSigner(new MemoryKeyStore(), new Uint8Array(randomBytes(32))),
      reef: () => [],
      log: createLogger({}, () => {}),
    });
    const app: OwnerApp = new Hono();
    app.use("*", async (c, next) => {
      c.set("owner", OWNER);
      c.set("network", "testnet" as SuiNetwork);
      await next();
    });
    app.onError((err, c) =>
      c.json(
        { error: (err as RemoraError).code ?? "unknown" },
        err instanceof RemoraError ? 400 : 500,
      ),
    );
    mountLedger(app, {
      service,
      runtime: { db, reef: () => reef, webBase: "http://web.test" } as unknown as RuntimeDeps,
    });
    const s = Statement.parse(await (await app.request("/api/statements?month=2026-11")).json());
    expect(s).toMatchObject({
      timezone: "Asia/Ho_Chi_Minh",
      total: "2017000",
      payments: 4,
      byOwner: "2000000",
      failed: 3,
    });
    expect(s.flags.map((f) => f.kind)).toEqual(
      expect.arrayContaining(["new_payee", "spike", "failed_run"]),
    );
    const res = await app.request("/api/statements/csv?month=2026-11");
    expect(res.headers.get("content-type")).toMatch(/^text\/csv/);
    expect(res.headers.get("content-disposition")).toContain(
      "remora-statement-testnet-2026-11.csv",
    );
    const rows = (await res.text()).trimEnd().split("\r\n");
    expect(rows).toHaveLength(5);
    expect(rows[1]).toContain(`http://web.test/verify/${d1}`);
    expect((await app.request("/api/statements?month=nope")).status).toBe(400);
  });
});
