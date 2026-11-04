import { randomUUID } from "node:crypto";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import {
  approvals,
  createDb,
  eq,
  receipts,
  remoraEvents,
  remoraMemories,
  remoras,
} from "@remora/db";
import { loadEnv } from "@remora/memory";
import { afterAll, describe, expect, it } from "vitest";
import type { RuntimeDeps } from "./deps.ts";
import {
  changeLine,
  checkProposal,
  DECLINE_WAIT_MS,
  declineProposal,
  type ProposalPayload,
  proposalsOf,
  ruleFor,
  windowBounds,
} from "./proposals.ts";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-20T12:00:00Z");
const budget = {
  coinType: "0x2::usdc::USDC",
  windowLimit: "500000",
  window: "month" as const,
  perPaymentCap: "20000",
  payees: ["reef:sui-risk"],
};
const month = windowBounds({ startMs: null, rateLimit: { months: 1 } }, NOW) as {
  startMs: number;
  endMs: number;
};

describe("budget proposal rules (E5)", () => {
  it("knows the window it's in", () => {
    expect(new Date(month.startMs).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(new Date(month.endMs).toISOString()).toBe("2026-12-01T00:00:00.000Z");
    const periodic = windowBounds(
      { startMs: NOW - 10 * DAY, rateLimit: { periodMs: 7 * DAY } },
      NOW,
    );
    expect(periodic).toEqual({ startMs: NOW - 3 * DAY, endMs: NOW + 4 * DAY });
    expect(windowBounds({ startMs: null, rateLimit: null }, NOW)).toBeNull();
  });

  it("proposes a lower limit when a week passed with under 20% used", () => {
    const hit = ruleFor({
      budget,
      window: { limit: 500_000n, spent: 70_000n, ...month },
      now: NOW,
      budgetSinceMs: NOW - 14 * DAY,
      paid7d: [10_000n, 10_000n],
      asked7d: [],
    });
    expect(hit?.rule).toBe("unused");
    expect(hit?.to.windowLimit).toBe(170_000n);
    expect(hit?.numbers).toMatchObject({ spent: "0.07", limit: "0.50", used: "14%", days: "14" });
  });

  it("waits a week before calling a limit unused", () => {
    expect(
      ruleFor({
        budget,
        window: { limit: 500_000n, spent: 0n, ...month },
        now: NOW,
        budgetSinceMs: NOW - 3 * DAY,
        paid7d: [],
        asked7d: [],
      }),
    ).toBeNull();
  });

  it("proposes a higher limit when 80% is gone with over 30% of the window left", () => {
    const start = NOW - 5 * DAY;
    const hit = ruleFor({
      budget: { ...budget, windowLimit: "50000" },
      window: { limit: 50_000n, spent: 45_000n, startMs: start, endMs: start + 30 * DAY },
      now: NOW,
      budgetSinceMs: start,
      paid7d: [],
      asked7d: [],
    });
    expect(hit?.rule).toBe("near_limit");
    // Never more than three times the limit, however fast the pace.
    expect(hit?.to.windowLimit).toBe(150_000n);
    expect(hit?.numbers.used).toBe("90%");
  });

  it("puts approvals first, and caps the new per-payment cap at the limit", () => {
    const hit = ruleFor({
      budget,
      window: { limit: 500_000n, spent: 450_000n, ...month },
      now: NOW,
      budgetSinceMs: NOW - 30 * DAY,
      paid7d: [],
      asked7d: [30_000n, 45_000n],
    });
    expect(hit).toMatchObject({
      rule: "approvals",
      to: { windowLimit: 500_000n, perPaymentCap: 50_000n },
    });
  });

  it("raises the cap when every payment hits it", () => {
    const hit = ruleFor({
      budget,
      window: null,
      now: NOW,
      budgetSinceMs: NOW - 30 * DAY,
      paid7d: [20_000n, 20_000n, 20_000n, 20_000n, 20_000n],
      asked7d: [],
    });
    expect(hit).toMatchObject({ rule: "cap_hit", to: { perPaymentCap: 30_000n } });
  });

  it("says the change in words", () => {
    expect(changeLine(budget, { ...budget, windowLimit: "200000" })).toBe(
      "Lower its monthly limit 0.50 → 0.20 USDC",
    );
    expect(changeLine(budget, { ...budget, perPaymentCap: "50000" })).toBe(
      "Raise its per-payment cap 0.02 → 0.05 USDC",
    );
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("budget proposals end to end in Postgres (E5)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x0e5${process.pid.toString(16)}`);
  const written: string[] = [];
  const told: string[] = [];
  const log = createLogger({}, () => {});
  const deps = {
    db,
    log,
    webBase: "http://web.test",
    brain: {
      answerModel: "test/model",
      answer: async () => ({ text: "I spent 0.07 of 0.50 in two weeks.", tokens: 3 }),
    },
    memory: {
      recall: async () => [],
      remember: async (_r: unknown, _ns: string, _t: string, text: string) => {
        written.push(text);
        const [m] = await db
          .insert(remoraMemories)
          .values({
            remoraId: rid,
            namespace: "feedback",
            type: "budget",
            blobId: `blob-outcome-${written.length}`,
            status: "stored",
          })
          .returning({ id: remoraMemories.id });
        return { saved: true, note: "", indexId: m?.id };
      },
    },
    notifier: {
      send: async (_o: string, n: { text: string }) => {
        told.push(n.text);
        return "sent" as const;
      },
    },
  } as unknown as RuntimeDeps;
  const read = async () => ({
    allowance: {
      startMs: NOW - 40 * DAY,
      rateLimit: { limit: 500_000n, spent: 70_000n, months: 1 },
    },
    disc: { perPaymentCap: 20_000n },
  });
  let rid = "";

  afterAll(async () => {
    await db.delete(remoras).where(eq(remoras.ownerAddress, OWNER));
    await db.delete(receipts).where(eq(receipts.remoraId, rid));
  });

  it("proposes with cited memories, remembers a decline, waits, then cites the decline", async () => {
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "scout",
        name: "Researcher",
        config: { budget, persona: "x" },
        status: "active",
        address: normalizeSuiAddress("0xabc"),
        discId: "0xd15c",
        allowanceId: "0xa11",
        capId: "0xcab",
        createdAt: new Date(NOW - 30 * DAY),
      })
      .returning();
    if (!r) throw new Error("no remora");
    rid = r.id;
    const at = new Date(NOW - 2 * DAY);
    await db.insert(remoraEvents).values({
      remoraId: r.id,
      network: "testnet",
      type: "payment",
      summary: "Paid",
      payload: { amount: "10000", payee: "reef:sui-risk" },
      createdAt: at,
    });

    const opts = { now: NOW, read } as unknown as Parameters<typeof checkProposal>[2];
    // No memory to cite yet: no proposal.
    expect(await checkProposal(deps, r, opts)).toEqual({ skipped: "no memory to cite yet" });

    await db.insert(receipts).values({
      network: "testnet",
      remoraId: r.id,
      agent: r.address,
      wake: {
        intent: {
          decision: { action: "pay", payee: "reef:sui-risk", amount: "10000", reason: "risk" },
        },
      },
      intentHash: randomUUID(),
      createdAt: at,
    });
    await db.insert(remoraMemories).values({
      remoraId: r.id,
      namespace: "receipts",
      type: "wake",
      blobId: "blob-wake-1",
      status: "stored",
      createdAt: new Date(at.getTime() + 2_000),
    });

    const first = await checkProposal(deps, r, opts);
    expect(first).toHaveProperty("proposalId");
    const open = (await proposalsOf(deps, r)).open;
    expect(open?.summary).toBe("Lower its monthly limit 0.50 → 0.08 USDC");
    expect(open?.cites).toEqual([
      expect.objectContaining({ blobId: "blob-wake-1", label: "paid 0.01 USDC to Sui risk check" }),
    ]);
    expect(open?.reason).toBe("I spent 0.07 of 0.50 in two weeks.");
    expect(told.at(-1)).toContain("Researcher proposes: Lower its monthly limit");
    // One open proposal at a time.
    expect(await checkProposal(deps, r, opts)).toEqual({ skipped: "a proposal is already open" });

    await declineProposal(deps, OWNER, open?.id as string, "I'm testing a big month");
    expect(written.at(-1)).toMatch(
      /^PROPOSAL unused · Lower its monthly limit 0\.50 → 0\.08 USDC · declined · because I'm testing a big month · as_of /,
    );
    const [declined] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, open?.id as string));
    expect(declined?.status).toBe("rejected");

    // The same change waits a week after a decline.
    expect(await checkProposal(deps, r, { ...opts, now: Date.now() + DAY })).toEqual({
      skipped: "declined less than 7 days ago",
    });
    const later = await checkProposal(deps, r, {
      ...opts,
      now: Date.now() + DECLINE_WAIT_MS + DAY,
    });
    expect(later).toHaveProperty("proposalId");
    const next = (await proposalsOf(deps, r)).open as unknown as ProposalPayload;
    expect(next.previous).toMatchObject({
      outcome: "declined",
      rule: "unused",
      reason: "I'm testing a big month",
    });
    // The decline itself is the first memory it cites.
    expect(next.cites[0]).toMatchObject({ namespace: "feedback", blobId: "blob-outcome-1" });
  });
});
