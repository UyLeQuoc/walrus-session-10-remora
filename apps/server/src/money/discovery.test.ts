/**
 * U19 C4 (ADR-0141): the Reef's Bazaar catalog. The contract below is the list response of the x402
 * spec (§8.1, `specs/extensions/bazaar.md`) and CDP's `GET /v2/x402/discovery/resources`.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, eq, remoras } from "@remora/db";
import { X402_VERSION } from "@remora/disc-sdk";
import { loadEnv } from "@remora/memory";
import { HOUSE_DOORS, x402 } from "@remora/merchant";
import { Hono } from "hono";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  type Check,
  catalogItems,
  createDiscovery,
  type DiscoveryQuery,
  discoveryPage,
  discoveryQuery,
  isPublicUrl,
  offerOf,
  SALE_DISCOVERY,
  saleDoor,
} from "./discovery.ts";
import { createListings } from "./listings.ts";
import { type ResolvedReef, reefFor } from "./reef.ts";
import { scoreOf } from "./reputation.ts";

const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
const HOUSE_PAY = normalizeSuiAddress("0x3e");
const LISTER = normalizeSuiAddress("0x5e11");
const SELLER = normalizeSuiAddress("0x0a11");
const MERCHANTS = "http://127.0.0.1:8799";
const FAC = "http://127.0.0.1:8798";
const NOW = "2026-11-05T12:00:00.000Z";
const log = createLogger({}, () => {});
const q = (o: Record<string, string> = {}): DiscoveryQuery => discoveryQuery.parse(o);

const house = reefFor(
  { MERCHANTS_URL_TESTNET: MERCHANTS, MERCHANT_PAYTO_TESTNET: HOUSE_PAY },
  "testnet",
);
const community: ResolvedReef = {
  ref: "reef:community-haiku",
  slug: "community-haiku",
  name: "@haiku",
  description: "A haiku about your question",
  path: "/haiku",
  price: "5000",
  url: "https://haiku.example.com/haiku",
  payTo: LISTER,
};
const sale: ResolvedReef = {
  ref: "reef:remora-uy-researcher",
  slug: "remora-uy-researcher",
  name: "@uy-researcher",
  description: "Researches Sui questions",
  path: "/api/x402/r/uy-researcher",
  price: "10000",
  url: "https://api.example.com/api/x402/r/uy-researcher",
  payTo: SELLER,
};
const communityOffer = {
  scheme: "exact" as const,
  network: "sui:testnet" as const,
  amount: "5000",
  asset: USDC,
  payTo: LISTER,
  maxTimeoutSeconds: 60,
  description: "A haiku about your question",
  extra: { gasStation: "https://getremora.vercel.app/api/facilitator/gas" },
};
const allChecked = (): Map<string, Check> =>
  new Map<string, Check>([
    ...house.map((e): [string, Check] => [e.ref, { at: NOW }]),
    [community.ref, { at: NOW, offer: communityOffer }],
  ]);
const build = (o: Partial<Parameters<typeof catalogItems>[0]> = {}) =>
  catalogItems({
    entries: [sale, community, ...house],
    usdc: USDC,
    facilitatorUrl: FAC,
    disc: false,
    checks: allChecked(),
    allowPrivate: true,
    now: NOW,
    ...o,
  });

/** The Bazaar list response, from the docs (x402 spec §8.1; CDP's x402DiscoveryResourcesResponse). */
const Printable = z.string().regex(/^[\x20-\x7e]{1,32}$/);
const BazaarResponse = z.object({
  x402Version: z.number().int().min(1).max(2),
  items: z.array(
    z.object({
      resource: z.string().url(),
      type: z.literal("http"),
      x402Version: z.number().int().min(1).max(2),
      accepts: z
        .array(
          z.object({
            scheme: z.literal("exact"),
            network: z.literal("sui:testnet"),
            amount: z.string().regex(/^\d+$/),
            asset: z.string().min(1),
            payTo: z.string().regex(/^0x[0-9a-f]{64}$/),
            maxTimeoutSeconds: z.number().int().positive(),
          }),
        )
        .min(1),
      lastUpdated: z.iso.datetime(),
      description: z.string().max(500).optional(),
      mimeType: z.string().optional(),
      serviceName: Printable.optional(),
      tags: z.array(Printable).max(5).optional(),
      extensions: z
        .object({
          bazaar: z.object({
            info: z.object({
              input: z.object({ type: z.literal("http"), method: z.literal("GET") }),
              output: z.object({ type: z.string() }).optional(),
            }),
            schema: z.object({
              $schema: z.literal("https://json-schema.org/draft/2020-12/schema"),
              type: z.literal("object"),
              required: z.array(z.string()).refine((r) => r.includes("input")),
            }),
            routeTemplate: z
              .string()
              .regex(/^\/[a-zA-Z0-9_/:.\-~%]+$/)
              .optional(),
          }),
        })
        .optional(),
      metadata: z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        reefScore: z.string().min(1),
      }),
    }),
  ),
  pagination: z.object({
    limit: z.number().int().min(1).max(100),
    offset: z.number().int().min(0),
    total: z.number().int().min(0),
  }),
});

describe("the Reef's Bazaar catalog (ADR-0141)", () => {
  it("answers in the Bazaar list shape", () => {
    const page = BazaarResponse.parse(discoveryPage(build(), q({ limit: "100" })));
    expect(page.x402Version).toBe(X402_VERSION);
    expect(page.pagination).toEqual({ limit: 100, offset: 0, total: 10 });
    expect(page.items.map((i) => i.metadata.name)).toEqual([
      "Sui risk check",
      "Odds",
      "Brief",
      "Wallet X-ray",
      "Walrus blob check",
      "Repo health",
      "Prices",
      "Weather",
      "@haiku",
      "@uy-researcher",
    ]);
  });

  it("gives a house door the requirements and the extension its own 402 states", async () => {
    const weather = build().find((i) => i.metadata.ref === "reef:weather");
    expect(weather).toMatchObject({
      resource: `${MERCHANTS}/weather`,
      lastUpdated: NOW,
      serviceName: "Weather",
      tags: ["remora-reef", "house", "everyday"],
      metadata: { kind: "house", category: "Everyday", reefScore: "new" },
    });
    const app = new Hono();
    app.get(
      "/weather",
      x402({
        amount: "5000",
        description: HOUSE_DOORS.weather.description,
        discovery: HOUSE_DOORS.weather.discovery,
        networks: { testnet: { payTo: HOUSE_PAY, asset: USDC, facilitatorUrl: FAC } },
        mpp: false,
      }),
    );
    const door = (await (await app.request(`${MERCHANTS}/weather`)).json()) as {
      accepts: unknown[];
      extensions: unknown;
    };
    expect(weather?.accepts).toEqual(door.accepts);
    expect(weather?.extensions).toEqual(door.extensions);
  });

  it("fills a path door's example, and keeps its route template", () => {
    const github = build().find((i) => i.metadata.ref === "reef:github");
    expect(github?.resource).toBe(`${MERCHANTS}/github/MystenLabs/sui`);
    expect(github?.extensions.bazaar.routeTemplate).toBe("/github/:owner/:repo");
    expect(github?.accepts[0]?.resource).toBe(`${MERCHANTS}/github/MystenLabs/sui`);
  });

  it("states a remora's sale door and a community API as they answer", () => {
    const items = build({
      scores: new Map([
        [
          sale.ref,
          scoreOf({
            ref: sale.ref,
            calls: 30,
            owners: 4,
            failed: 0,
            useful: 9,
            noise: 1,
            medianMs: 900,
          }),
        ],
      ]),
    });
    const s = items.find((i) => i.metadata.kind === "remora");
    expect(s?.accepts).toEqual([
      expect.objectContaining({
        amount: "10000",
        payTo: SELLER,
        maxTimeoutSeconds: saleDoor("@uy-researcher").maxTimeoutSeconds,
        description: "@uy-researcher's answer",
      }),
    ]);
    expect(s?.extensions.bazaar.info.input.queryParams).toEqual({
      q: SALE_DISCOVERY.query?.q?.example,
    });
    expect(s?.metadata.reefScore).toBe("90% useful · 30 paid calls · 4 owners · last 7 days");
    const c = items.find((i) => i.metadata.kind === "community");
    expect(c?.accepts).toEqual([communityOffer]);
    expect(c?.extensions.bazaar.info).toEqual({ input: { type: "http", method: "GET" } });
  });

  it("pages with limit and offset, caps limit at 100 and filters like the spec", () => {
    const all = build();
    const page = discoveryPage(all, q({ limit: "3", offset: "8" }));
    expect(page.items.map((i) => i.metadata.ref)).toEqual([
      "reef:community-haiku",
      "reef:remora-uy-researcher",
    ]);
    expect(page.pagination).toEqual({ limit: 3, offset: 8, total: 10 });
    expect(q({ limit: "500" }).limit).toBe(100);
    expect(q().limit).toBe(20);
    expect(discoveryQuery.safeParse({ limit: "0" }).success).toBe(false);
    expect(discoveryQuery.safeParse({ offset: "-1" }).success).toBe(false);
    expect(discoveryQuery.safeParse({ limit: "ten" }).success).toBe(false);
    expect(discoveryPage(all, q({ type: "mcp" })).pagination.total).toBe(0);
    expect(discoveryPage(all, q({ network: "eip155:8453" })).pagination.total).toBe(0);
    expect(discoveryPage(all, q({ network: "sui:testnet" })).pagination.total).toBe(10);
    const mine = discoveryPage(all, q({ payTo: "0xa11" }));
    expect(mine.items.map((i) => i.metadata.ref)).toEqual(["reef:remora-uy-researcher"]);
  });

  it("leaves out what isn't verified: unchecked, unreachable, changed, or the demo attacker", () => {
    const refs = (checks: Map<string, Check>, entries = [sale, community, ...house]) =>
      build({ checks, entries }).map((i) => i.metadata.ref);
    const noHouse = new Map([[community.ref, { at: NOW, offer: communityOffer }]]);
    expect(refs(noHouse)).toEqual(["reef:community-haiku", "reef:remora-uy-researcher"]);
    const noCommunity = allChecked();
    noCommunity.delete(community.ref);
    expect(refs(noCommunity)).not.toContain("reef:community-haiku");
    const attack = reefFor(
      {
        MERCHANTS_URL_TESTNET: MERCHANTS,
        MERCHANT_PAYTO_TESTNET: HOUSE_PAY,
        DEMO_ATTACK: "1",
      },
      "testnet",
    );
    expect(refs(allChecked(), attack)).not.toContain("reef:market");
    expect(
      offerOf(
        { accepts: [{ ...communityOffer, amount: "9000" }] },
        {
          usdc: USDC,
          payTo: LISTER,
          price: "5000",
        },
      ),
    ).toBeNull();
    expect(
      offerOf(
        { accepts: [{ ...communityOffer, payTo: normalizeSuiAddress("0xbad") }] },
        {
          usdc: USDC,
          payTo: LISTER,
          price: "5000",
        },
      ),
    ).toBeNull();
  });

  it("lists public https only when deployed", () => {
    const deployed = build({ allowPrivate: false }).map((i) => i.metadata.ref);
    expect(deployed).toEqual(["reef:community-haiku", "reef:remora-uy-researcher"]);
    expect(isPublicUrl("https://getremora.vercel.app/api/x402/r/a")).toBe(true);
    expect(isPublicUrl("http://api.example.com/x")).toBe(false);
    expect(isPublicUrl("https://127.0.0.1/x")).toBe(false);
    expect(isPublicUrl("https://10.0.0.8/x")).toBe(false);
    expect(isPublicUrl("https://localhost/x")).toBe(false);
  });
});

describe("the catalog's checks and cache (ADR-0141)", () => {
  const world = () => {
    let t = Date.parse(NOW);
    let merchantsUp = true;
    let haikuStatus = 402;
    const calls: string[] = [];
    const http = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url === `${MERCHANTS}/health`)
        return merchantsUp ? Response.json({ ok: true }) : new Response("down", { status: 503 });
      if (url.startsWith(community.url))
        return Response.json({ accepts: [communityOffer] }, { status: haikuStatus });
      return new Response("?", { status: 404 });
    }) as typeof fetch;
    const discovery = createDiscovery({
      entries: () => [sale, community, ...house],
      config: () => ({ usdc: USDC, facilitatorUrl: FAC }),
      disc: false,
      allowPrivate: true,
      log,
      fetch: http,
      now: () => t,
    });
    return {
      discovery,
      calls,
      tick: (ms: number) => {
        t += ms;
      },
      down: () => {
        merchantsUp = false;
        haikuStatus = 500;
      },
    };
  };

  it("checks the merchants and each community API, then serves a cached catalog for a minute", async () => {
    const w = world();
    const first = await w.discovery.resources(q({ limit: "100" }));
    expect(first.pagination.total).toBe(10);
    expect(w.calls.sort()).toEqual([`${MERCHANTS}/health`, community.url]);
    w.tick(30_000);
    await w.discovery.resources(q({ offset: "5" }));
    expect(w.calls).toHaveLength(2);
  });

  it("drops what stops answering at the next check", async () => {
    const w = world();
    await w.discovery.resources(q());
    w.down();
    w.tick(61_000);
    expect((await w.discovery.resources(q())).pagination.total).toBe(10);
    w.tick(5 * 60_000);
    const later = await w.discovery.resources(q());
    expect(later.items.map((i) => i.metadata.ref)).toEqual(["reef:remora-uy-researcher"]);
  });

  it("is empty while payments are off on testnet", async () => {
    const off = createDiscovery({
      entries: () => [sale, ...house],
      config: () => ({ usdc: USDC, facilitatorUrl: null }),
      disc: false,
      allowPrivate: true,
      log,
    });
    expect(await off.resources(q())).toEqual({
      x402Version: X402_VERSION,
      items: [],
      pagination: { limit: 20, offset: 0, total: 0 },
    });
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("a retired remora's listings leave the catalog (Postgres)", () => {
  const db = createDb(local as string);
  const slug = `disc-${process.pid}`;
  const made: string[] = [];
  afterAll(async () => {
    for (const id of made) await db.delete(remoras).where(eq(remoras.id, id));
  });

  it("lists its sale and its API while it's active, and neither once it's retired", async () => {
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: SELLER,
        network: "testnet",
        template: "researcher",
        name: "Discovery test",
        status: "active",
        address: normalizeSuiAddress("0xd15c"),
        config: {
          sell: { on: true, slug, price: "10000", blurb: "test sale" },
          listings: [
            {
              slug: `${slug}-api`,
              url: "http://haiku.test/haiku",
              payTo: LISTER,
              price: "5000",
              description: "A haiku",
              blurb: "haikus",
              network: "testnet",
              lister: SELLER,
              probedAt: NOW,
              message: "",
              signature: "",
            },
          ],
        },
      })
      .returning();
    if (!r) throw new Error("no remora");
    made.push(r.id);
    const listings = createListings({ db, base: "http://localhost:8901", log });
    let t = Date.parse(NOW);
    const discovery = createDiscovery({
      entries: () => listings.entries("testnet"),
      config: () => ({ usdc: USDC, facilitatorUrl: FAC }),
      disc: false,
      allowPrivate: true,
      log,
      fetch: (async () =>
        Response.json(
          { accepts: [{ ...communityOffer, payTo: LISTER }] },
          { status: 402 },
        )) as unknown as typeof fetch,
      now: () => t,
    });
    const mine = async () => (await discovery.resources(q({ limit: "100", payTo: "0xa11" }))).items;
    const ours = async () =>
      (await discovery.resources(q({ limit: "100" }))).items
        .map((i) => i.metadata.ref)
        .filter((ref) => ref.includes(slug));

    await listings.refresh();
    expect(await ours()).toEqual([`reef:community-${slug}-api`, `reef:remora-${slug}`]);
    expect((await mine()).map((i) => i.resource)).toContain(
      `http://localhost:8901/api/x402/r/${slug}`,
    );

    await db.update(remoras).set({ status: "retired" }).where(eq(remoras.id, r.id));
    await listings.refresh();
    t += 5 * 60_000;
    expect(await ours()).toEqual([]);
  });
});
