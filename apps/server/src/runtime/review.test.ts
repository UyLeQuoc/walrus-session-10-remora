import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, eq, remoraEvents, remoraMemories, remoras } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { afterAll, describe, expect, it } from "vitest";
import type { RuntimeDeps } from "./deps.ts";
import { nextMonday9, plainLines, type ReviewFacts, reviewsOf, writeReview } from "./review.ts";

const facts: ReviewFacts = {
  from: "2026-11-02",
  to: "2026-11-09",
  days: [],
  spent: "70000",
  limit: "500000",
  bought: [
    { payee: "reef:sui-risk", calls: 4, spent: "40000", useful: 3, noise: 0 },
    { payee: "reef:odds", calls: 3, spent: "30000", useful: 0, noise: 2 },
  ],
  useful: 3,
  noise: 2,
  taught: ["ignore incoming SUI under 0.01"],
  proposals: [
    {
      summary: "Lower its monthly limit 0.50 → 0.08 USDC",
      outcome: "declined",
      reason: "a big month",
    },
  ],
  answers: 6,
};

describe("weekly review (F10)", () => {
  it("words the week from its numbers, and quotes last week", () => {
    expect(plainLines(facts, "I spent 0.02 USDC")).toEqual([
      "I spent 0.07 USDC of my 0.50 limit on 7 purchases, and answered 6 times.",
      "Sui risk check was worth it: 3 useful of 4 buys.",
      "I trust Odds less: 2 answers it fed were noise.",
      "You rated 3 answers useful and 2 noise.",
      "You taught me: ignore incoming SUI under 0.01.",
      'You declined "Lower its monthly limit 0.50 → 0.08 USDC" because a big month.',
      'Last week I said: "I spent 0.02 USDC"',
    ]);
  });

  it("finds next Monday at 09:00 in the owner's timezone", () => {
    // Thursday Nov 5, 2026, 01:00 UTC.
    const now = new Date("2026-11-05T01:00:00Z");
    expect(nextMonday9(now, "UTC").toISOString()).toBe("2026-11-09T09:00:00.000Z");
    // Vietnam is UTC+7: Monday 09:00 there is 02:00 UTC.
    expect(nextMonday9(now, "Asia/Ho_Chi_Minh").toISOString()).toBe("2026-11-09T02:00:00.000Z");
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("weekly review in Postgres (F10)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x0e9${process.pid.toString(16)}`);
  const written: string[] = [];
  const told: string[] = [];
  let rid = "";
  const deps = {
    db,
    log: createLogger({}, () => {}),
    webBase: "http://web.test",
    brain: {
      answerModel: "test/model",
      answer: async () => {
        throw new Error("model down");
      },
    },
    memory: {
      remember: async (_r: unknown, _ns: string, _t: string, text: string) => {
        written.push(text);
        const [m] = await db
          .insert(remoraMemories)
          .values({
            remoraId: rid,
            namespace: "feedback",
            type: "episode",
            blobId: `blob-review-${written.length}`,
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
  afterAll(async () => {
    await db.delete(remoras).where(eq(remoras.ownerAddress, OWNER));
  });

  it("writes a review to memory, and the next one refers to it", async () => {
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "scout",
        name: "Researcher",
        config: { budget: { windowLimit: "500000" } },
        status: "active",
        address: OWNER,
      })
      .returning();
    if (!r) throw new Error("no remora");
    rid = r.id;
    await db.insert(remoraEvents).values([
      {
        remoraId: r.id,
        network: "testnet",
        type: "payment",
        summary: "Paid",
        payload: { payee: "reef:sui-risk", amount: "10000" },
      },
      {
        remoraId: r.id,
        network: "testnet",
        type: "answer",
        summary: "q",
        payload: { paidPayees: ["reef:sui-risk"] },
        feedback: "useful",
      },
    ]);
    await writeReview(deps, r);
    expect(written[0]).toMatch(
      /^REVIEW \d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2} · I spent 0\.01 USDC of my 0\.50 limit on 1 purchases, and answered 1 times\./,
    );
    expect(told[0]).toMatch(/^Researcher's week:\n• I spent 0\.01 USDC/);
    await writeReview(deps, r);
    const [second, first] = await reviewsOf(deps, r);
    expect(second?.previousId).toBe(first?.id);
    expect(second?.lines.at(-1)).toMatch(/^Last week I said: "I spent 0\.01 USDC/);
    expect(first?.blobId).toBe("blob-review-1");
    expect(second?.facts.days).toHaveLength(7);
  });
});
