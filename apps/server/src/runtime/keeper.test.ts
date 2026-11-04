import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { approvals, createDb, eq, remoraEvents, remoras } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { afterAll, describe, expect, it } from "vitest";
import type { RuntimeDeps } from "./deps.ts";
import { acceptPrice, addSubscription, charge, isHike, quote, subscriptionsOf } from "./keeper.ts";

const USDC = "0x2::usdc::USDC";
const PAYTO = normalizeSuiAddress("0xfeed");
const URL_ = "http://feed.test/haiku?q=walrus";
const four02 = (amount: string) =>
  new Response(
    JSON.stringify({
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "sui:testnet",
          amount,
          asset: USDC,
          payTo: PAYTO,
          maxTimeoutSeconds: 60,
        },
      ],
    }),
    { status: 402 },
  );

describe("Subscriptions keeper (B2)", () => {
  it("calls 20% over the remembered price a hike", () => {
    expect(isHike(6_000n, 5_000n)).toBe(true);
    expect(isHike(5_999n, 5_000n)).toBe(false);
    expect(isHike(4_000n, 5_000n)).toBe(false);
  });

  it("reads the price from the 402 before paying", async () => {
    const deps = {
      networks: { config: () => ({ usdcCoinType: USDC }) },
      fetch: (async () => four02("5000")) as unknown as typeof fetch,
    } as unknown as RuntimeDeps;
    expect(await quote(deps, { network: "testnet" }, URL_)).toEqual({
      amount: 5000n,
      payTo: PAYTO,
    });
    const ok = { ...deps, fetch: (async () => new Response("free")) as unknown as typeof fetch };
    expect(await quote(ok, { network: "testnet" }, URL_)).toEqual({
      error: "answered 200, not 402",
    });
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("Subscriptions keeper in Postgres (B2)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x0ee${process.pid.toString(16)}`);
  const told: string[] = [];
  const remembered: string[] = [];
  let price = "6000";
  const deps = {
    db,
    log: createLogger({}, () => {}),
    webBase: "http://web.test",
    networks: { config: () => ({ usdcCoinType: USDC }) },
    reef: () => [
      {
        ref: "reef:community-haiku",
        slug: "community-haiku",
        name: "haiku",
        description: "",
        path: "/haiku",
        price: "5000",
        url: "http://feed.test/haiku",
        payTo: PAYTO,
      },
    ],
    fetch: (async () => four02(price)) as unknown as typeof fetch,
    memory: {
      remember: async (_r: unknown, _ns: string, _t: string, text: string) => {
        remembered.push(text);
        return { saved: true, note: "" };
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

  it("stops on a hike over the remembered price, and pays once the owner accepts it", async () => {
    const [r0] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "keeper",
        name: "Keeper",
        config: { budget: { payees: ["reef:community-haiku"] } },
        status: "active",
        address: OWNER,
      })
      .returning();
    if (!r0) throw new Error("no remora");
    await expect(
      addSubscription(deps, { ...r0, config: {} }, { ref: "reef:community-haiku", url: URL_ }),
    ).rejects.toMatchObject({ code: "subscription.payee" });
    const r1 = await addSubscription(deps, r0, { ref: "reef:community-haiku", url: URL_ });
    const s = subscriptionsOf(r1)[0];
    if (!s) throw new Error("no subscription");
    // As if two normal charges at 0.005 had set the remembered price.
    const r2 = await acceptPrice(deps, r1, s.id, "5000");
    expect(remembered.at(-1)).toMatch(/^PRICE reef:community-haiku · usually 0\.005 USDC a charge/);

    const hike = await charge(deps, r2, subscriptionsOf(r2)[0] as typeof s);
    expect(hike).toMatchObject({ outcome: "hike", amount: "6000", usual: "5000" });
    expect(hike.note).toBe("@haiku now asks 0.006 USDC, up from 0.005");
    expect(told.at(-1)).toMatch(/I didn't pay\. Pay once, accept the new price, or cancel\?$/);
    const events = await db.select().from(remoraEvents).where(eq(remoraEvents.remoraId, r0.id));
    expect(events.some((e) => e.type === "price_hike")).toBe(true);
    const [a] = await db.select().from(approvals).where(eq(approvals.remoraId, r0.id));
    expect(a?.payload).toMatchObject({
      kind: "price_hike",
      amount: "6000",
      usual: "5000",
      viaDisc: true,
    });

    // A small rise (under 20%) isn't a hike.
    price = "5500";
    const r3 = await acceptPrice(deps, r2, s.id, "5000");
    const quiet = subscriptionsOf(r3)[0] as typeof s;
    expect(isHike(5_500n, BigInt(quiet.usual ?? "0"))).toBe(false);
  });
});
