import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createDb, inArray, remoraEvents, remoras } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { afterAll, describe, expect, it } from "vitest";
import { reefServices } from "./reef.ts";
import { readScores, scoreLine, scoreOf, skipReason } from "./reputation.ts";

const base = {
  ref: "reef:odds",
  calls: 0,
  owners: 0,
  failed: 0,
  useful: 0,
  noise: 0,
  medianMs: null,
};

describe("Reef reputation (E10)", () => {
  it("says new until 3 owners or 20 calls, then a line of counts", () => {
    expect(scoreOf({ ...base, calls: 19, owners: 2 }).status).toBe("new");
    expect(scoreOf({ ...base, calls: 3, owners: 3 }).status).toBe("scored");
    const s = scoreOf({ ...base, calls: 214, owners: 6, failed: 4, useful: 23, noise: 2 });
    expect(s).toMatchObject({ settledPct: 98, usefulPct: 92, status: "scored" });
    expect(scoreLine(s)).toBe("92% useful · 214 paid calls · 6 owners · last 7 days");
    expect(scoreLine(scoreOf({ ...base, calls: 5, owners: 1 }))).toBe("new");
    expect(scoreLine(scoreOf({ ...base, calls: 30, owners: 1 }))).toBe(
      "30 paid calls · 1 owner · last 7 days",
    );
  });

  it("skips a service under 40% useful only after 20 rated answers", () => {
    expect(
      skipReason(scoreOf({ ...base, calls: 40, owners: 4, useful: 5, noise: 14 }), "odds"),
    ).toBeNull();
    expect(
      skipReason(scoreOf({ ...base, calls: 40, owners: 4, useful: 6, noise: 16 }), "odds"),
    ).toBe("skipped odds: 27% useful over 22 rated answers from 4 owners (last 7 days)");
    expect(
      skipReason(scoreOf({ ...base, calls: 40, owners: 4, useful: 9, noise: 11 }), "odds"),
    ).toBeNull();
    expect(skipReason(undefined, "odds")).toBeNull();
  });

  it("puts each service's ref and score on the Reef's list", () => {
    const list = reefServices(
      [
        {
          ref: "reef:odds",
          slug: "odds",
          name: "odds",
          description: "",
          path: "/odds",
          price: "20000",
          url: "http://m.test/odds",
          payTo: "0x1",
        },
      ],
      new Map([["reef:odds", scoreOf({ ...base, calls: 25, owners: 2, useful: 3, noise: 1 })]]),
    );
    expect(list[0]).toMatchObject({
      ref: "reef:odds",
      score: {
        status: "scored",
        calls: 25,
        usefulPct: 75,
        line: "75% useful · 25 paid calls · 2 owners · last 7 days",
      },
    });
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("Reef reputation from Postgres (E10)", () => {
  const db = createDb(local as string);
  const owners = [1, 2, 3].map((i) => normalizeSuiAddress(`0x0e1${i}${process.pid.toString(16)}`));
  const ids: string[] = [];
  afterAll(async () => {
    await db.delete(remoras).where(inArray(remoras.ownerAddress, owners));
  });

  it("counts only shared remoras' payments, refusals and ratings, from the last 7 days", async () => {
    const ref = `reef:rep-${process.pid}`;
    for (const [i, owner] of owners.entries()) {
      const [r] = await db
        .insert(remoras)
        .values({
          ownerAddress: owner,
          network: "testnet",
          template: "scout",
          name: `R${i}`,
          // The third owner doesn't share: its rows never count.
          config: i < 2 ? { share: { stats: true } } : {},
          status: "active",
          address: owner,
        })
        .returning();
      if (!r) throw new Error("no remora");
      ids.push(r.id);
      const ev = (type: string, payload: Record<string, unknown>, extra = {}) =>
        db.insert(remoraEvents).values({
          remoraId: r.id,
          network: "testnet",
          type,
          summary: type,
          payload,
          ...extra,
        });
      await ev("payment", { payee: ref, amount: "10000", ms: 1000 + i * 1000 });
      await ev("payment", { payee: ref, amount: "10000", ms: 3000 });
      await ev("payment", { payee: ref, amount: "10000", approvedBy: "owner" });
      await ev(
        "payment",
        { payee: ref, amount: "10000", ms: 9 },
        { createdAt: new Date(Date.now() - 9 * 86_400_000) },
      );
      await ev("blocked", { payee: ref, code: "x402.unsettled" });
      await ev("answer", { paidPayees: [ref] }, { feedback: i === 0 ? "useful" : "noise" });
    }
    const s = (await readScores(db, "testnet")).get(ref);
    expect(s).toMatchObject({
      calls: 4,
      owners: 2,
      failed: 2,
      useful: 1,
      noise: 1,
      medianMs: 2500,
      settledPct: 67,
      usefulPct: 50,
      status: "new",
    });
  });
});
