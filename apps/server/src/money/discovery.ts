/**
 * U19 C4 (ADR-0141): the Reef as an x402 Bazaar catalog. The public facilitator serves it at
 * `GET /api/facilitator/discovery/resources`, in the shape of the x402 spec's §8.1 and CDP's list
 * endpoint (`x402Version`, `items`, `pagination`), so indexers such as x402scan can find our doors.
 *
 * It lists only verified listings on testnet:
 * - house doors whose merchants answer `/health`;
 * - community APIs whose 402 still asks for their listed price at their listed address;
 * - remoras on sale (an active remora's sale is its own check).
 *
 * A retired remora's listings are gone from the Reef already. Every entry is data: a remora that
 * finds a service here still pays it only if its Disc lists the payee (ADR-0109).
 */
import { isIP } from "node:net";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { Logger } from "@remora/chain";
import { type PaymentRequirements, X402_VERSION } from "@remora/disc-sdk";
import {
  type BazaarExtension,
  bazaarExtension,
  type DoorDiscovery,
  exampleUrl,
  houseDoor,
  isPrivateAddress,
  requirementsFor,
} from "@remora/merchant";
import { z } from "zod";
import { probeX402 } from "./community.ts";
import { payeeLabel, type ResolvedReef, reefServices } from "./reef.ts";
import type { ReefScore } from "./reputation.ts";

export const DISCOVERY_LIMIT = { default: 20, max: 100 } as const;
/** How long a built catalog is served before it's built again. */
export const DISCOVERY_TTL_MS = 60_000;
/** How often the house merchants and the community APIs are checked. */
export const DISCOVERY_CHECK_MS = 5 * 60_000;
const CHECK_TIMEOUT_MS = 5_000;

export type ReefKind = "house" | "community" | "remora";

/** A remora on sale's paid door (`GET /api/x402/r/<slug>?q=`): the 402 it answers with. */
export const SALE_DISCOVERY: DoorDiscovery = {
  query: {
    q: { example: "What changed on Sui this week?", description: "A question, 1–500 characters." },
  },
  output: {
    example: {
      answer: "Three things changed this week…",
      remora: "@uy-researcher",
      eventId: "4f1c2b7e-0000-4000-8000-000000000000",
      at: "2026-11-05T09:00:00.000Z",
    },
  },
};
export const saleDoor = (name: string) => ({
  description: `${name}'s answer`,
  maxTimeoutSeconds: 120,
  discovery: SALE_DISCOVERY,
});

export interface DiscoveryItem {
  resource: string;
  type: "http";
  x402Version: number;
  accepts: PaymentRequirements[];
  lastUpdated: string;
  description: string;
  mimeType: "application/json";
  serviceName: string;
  tags: string[];
  extensions: { bazaar: BazaarExtension };
  metadata: {
    name: string;
    description: string;
    kind: ReefKind;
    category: string;
    ref: string;
    /** "92% useful · 214 paid calls · 6 owners · last 7 days", or "new" (ADR-0127). */
    reefScore: string;
  };
}

export interface DiscoveryResponse {
  x402Version: number;
  items: DiscoveryItem[];
  pagination: { limit: number; offset: number; total: number };
}

export const discoveryQuery = z.object({
  type: z.string().max(16).optional(),
  payTo: z.string().max(80).optional(),
  network: z.string().max(32).optional(),
  scheme: z.string().max(16).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .default(DISCOVERY_LIMIT.default)
    .transform((n) => Math.min(n, DISCOVERY_LIMIT.max)),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});
export type DiscoveryQuery = z.infer<typeof discoveryQuery>;

/** The last successful check of a house door or a community API; none means it's left out. */
export interface Check {
  at: string;
  /** A community API's offer, as its own 402 states it. */
  offer?: PaymentRequirements;
}

/** Public https, not a loopback name or a private address. */
export function isPublicUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (u.protocol !== "https:" || host === "localhost" || host.endsWith(".localhost"))
      return false;
    return !(isIP(host) && isPrivateAddress(host));
  } catch {
    return false;
  }
}

const ascii = (s: string, max: number) =>
  s
    .replace(/[^\x20-\x7e]/g, "")
    .trim()
    .slice(0, max);

const RANK: Record<ReefKind, number> = { house: 0, community: 1, remora: 2 };

export interface CatalogInput {
  entries: ResolvedReef[];
  scores?: Map<string, ReefScore> | undefined;
  usdc: string;
  facilitatorUrl: string;
  /** The house doors take Disc payments only (`MERCHANT_REQUIRE_DISC=1`), as their 402s say. */
  disc: boolean;
  checks: ReadonlyMap<string, Check>;
  /** A local run lists loopback and private hosts; a deployed one lists public https only. */
  allowPrivate: boolean;
  now: string;
}

/** The catalog's items, house doors first, each with the requirements its own 402 states. */
export function catalogItems(o: CatalogInput): DiscoveryItem[] {
  const items = o.entries.flatMap((e, index) => {
    const [svc] = reefServices([e], o.scores);
    const kind = svc?.kind;
    if (!svc || !kind) return [];
    const check = o.checks.get(e.ref);
    if (kind !== "remora" && !check) return [];
    const discovery =
      kind === "house" ? houseDoor(e.slug)?.discovery : kind === "remora" ? SALE_DISCOVERY : {};
    if (!discovery) return [];
    const resource = exampleUrl(e.url, discovery);
    if (!o.allowPrivate && !isPublicUrl(resource)) return [];
    const networks = {
      testnet: { payTo: e.payTo, asset: o.usdc, facilitatorUrl: o.facilitatorUrl },
    };
    const accepts =
      kind === "community"
        ? check?.offer
          ? [check.offer]
          : []
        : requirementsFor(
            kind === "house"
              ? {
                  amount: e.price,
                  description: houseDoor(e.slug)?.description ?? e.description,
                  networks,
                  ...(o.disc ? { disc: true } : {}),
                }
              : { amount: e.price, networks, ...saleDoor(e.name) },
            resource,
          );
    if (!accepts.length) return [];
    const name = payeeLabel(e.ref);
    const description = (svc.description ?? e.description).slice(0, 500);
    const item: DiscoveryItem = {
      resource,
      type: "http",
      x402Version: X402_VERSION,
      accepts,
      lastUpdated: check?.at ?? o.now,
      description,
      mimeType: "application/json",
      serviceName: ascii(name, 32) || ascii(e.slug, 32),
      tags: [...new Set(["remora-reef", kind, ascii(svc.category.toLowerCase(), 32)])].filter(
        Boolean,
      ),
      extensions: { bazaar: bazaarExtension(discovery) },
      metadata: {
        name,
        description,
        kind,
        category: svc.category,
        ref: e.ref,
        reefScore: svc.score?.line ?? "new",
      },
    };
    return [{ item, kind, index }];
  });
  return items
    .sort(
      (a, b) =>
        RANK[a.kind] - RANK[b.kind] ||
        (a.kind === "house"
          ? a.index - b.index
          : a.item.metadata.ref.localeCompare(b.item.metadata.ref)),
    )
    .map((x) => x.item);
}

const samePayTo = (a: string, b: string) => {
  try {
    return normalizeSuiAddress(a) === normalizeSuiAddress(b);
  } catch {
    return false;
  }
};

export function matches(q: DiscoveryQuery, item: DiscoveryItem): boolean {
  if (q.type && q.type !== item.type) return false;
  return item.accepts.some(
    (a) =>
      (!q.network || a.network === q.network || a.network === `sui:${q.network}`) &&
      (!q.scheme || a.scheme === q.scheme) &&
      (!q.payTo || samePayTo(a.payTo, q.payTo)),
  );
}

export function discoveryPage(all: DiscoveryItem[], q: DiscoveryQuery): DiscoveryResponse {
  const found = all.filter((i) => matches(q, i));
  return {
    x402Version: X402_VERSION,
    items: found.slice(q.offset, q.offset + q.limit),
    pagination: { limit: q.limit, offset: q.offset, total: found.length },
  };
}

const offerSchema = z.object({
  scheme: z.literal("exact"),
  network: z.literal("sui:testnet"),
  amount: z.string().regex(/^\d{1,12}$/),
  asset: z.string().min(1).max(200),
  payTo: z.string().min(1).max(80),
  maxTimeoutSeconds: z.number().int().positive().max(3600).catch(60),
  resource: z.string().url().max(2048).optional().catch(undefined),
  description: z.string().max(500).optional().catch(undefined),
  extra: z
    .object({
      gasStation: z.string().url().max(2048).optional().catch(undefined),
      disc: z.boolean().optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
});

/** The 402's offer for exactly the listed price at the listed address, in USDC on testnet. */
export function offerOf(
  body: unknown,
  listed: { usdc: string; payTo: string; price: string },
): PaymentRequirements | null {
  const accepts = (body as { accepts?: unknown } | null)?.accepts;
  if (!Array.isArray(accepts)) return null;
  for (const raw of accepts) {
    const p = offerSchema.safeParse(raw);
    if (!p.success) continue;
    const a = p.data;
    if (a.asset !== listed.usdc || a.amount !== listed.price || !samePayTo(a.payTo, listed.payTo))
      continue;
    const extra = {
      ...(a.extra?.gasStation ? { gasStation: a.extra.gasStation } : {}),
      ...(a.extra?.disc !== undefined ? { disc: a.extra.disc } : {}),
    };
    return {
      scheme: "exact",
      network: "sui:testnet",
      amount: a.amount,
      asset: a.asset,
      payTo: normalizeSuiAddress(a.payTo),
      maxTimeoutSeconds: a.maxTimeoutSeconds,
      ...(a.resource ? { resource: a.resource } : {}),
      ...(a.description ? { description: a.description } : {}),
      ...(Object.keys(extra).length ? { extra } : {}),
    };
  }
  return null;
}

export interface DiscoveryDeps {
  /** The Reef on testnet: house doors, community APIs and remoras on sale. */
  entries: () => ResolvedReef[];
  scores?: () => Map<string, ReefScore> | undefined;
  config: () => { usdc: string; facilitatorUrl: string | null };
  disc: boolean;
  allowPrivate: boolean;
  log: Logger;
  fetch?: typeof fetch;
  resolve?: (host: string) => Promise<string[]>;
  now?: () => number;
}

export interface Discovery {
  resources(q: DiscoveryQuery): Promise<DiscoveryResponse>;
}

const kindOf = (e: ResolvedReef): ReefKind | undefined => reefServices([e])[0]?.kind;

export function createDiscovery(d: DiscoveryDeps): Discovery {
  const http = d.fetch ?? fetch;
  const now = d.now ?? Date.now;
  let checks = new Map<string, Check>();
  let checkedAt = Number.NEGATIVE_INFINITY;
  let checking: Promise<void> | null = null;
  let cache: { at: number; items: DiscoveryItem[] } | null = null;

  async function checkAll(usdc: string) {
    const at = new Date(now()).toISOString();
    const listable = d.entries().filter((e) => d.allowPrivate || isPublicUrl(e.url));
    const next = new Map<string, Check>();
    const house = listable.filter((e) => kindOf(e) === "house");
    const origins = [...new Set(house.map((e) => new URL(e.url).origin))];
    const up = new Set<string>();
    await Promise.all(
      origins.map(async (origin) => {
        try {
          const res = await http(`${origin}/health`, {
            redirect: "manual",
            signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
          });
          if (res.ok) up.add(origin);
          else d.log.info("discovery.house_down", { status: res.status });
        } catch (err) {
          d.log.info("discovery.house_down", { error: (err as Error).name });
        }
      }),
    );
    for (const e of house) if (up.has(new URL(e.url).origin)) next.set(e.ref, { at });
    await Promise.all(
      listable
        .filter((e) => kindOf(e) === "community")
        .map(async (e) => {
          let seen: Response | undefined;
          const keep = (async (input: string | URL | Request, init?: RequestInit) => {
            const res = await http(input, init);
            seen = res.clone();
            return res;
          }) as typeof fetch;
          try {
            await probeX402(e.url, {
              usdc,
              allowPrivate: d.allowPrivate,
              fetch: keep,
              ...(d.resolve ? { resolve: d.resolve } : {}),
            });
            const offer = offerOf(await seen?.json().catch(() => null), {
              usdc,
              payTo: e.payTo,
              price: e.price,
            });
            if (offer) next.set(e.ref, { at, offer });
            else d.log.info("discovery.community_changed", { ref: e.ref });
          } catch (err) {
            d.log.info("discovery.community_down", {
              ref: e.ref,
              code: (err as { code?: string }).code ?? (err as Error).name,
            });
          }
        }),
    );
    checks = next;
    checkedAt = now();
  }

  async function items(): Promise<DiscoveryItem[]> {
    const t = now();
    if (cache && t - cache.at < DISCOVERY_TTL_MS) return cache.items;
    const { usdc, facilitatorUrl } = d.config();
    if (!usdc || !facilitatorUrl) {
      cache = { at: t, items: [] };
      return [];
    }
    if (t - checkedAt >= DISCOVERY_CHECK_MS) {
      checking ??= checkAll(usdc).finally(() => {
        checking = null;
      });
      await checking;
    }
    const built = catalogItems({
      entries: d.entries(),
      scores: d.scores?.(),
      usdc,
      facilitatorUrl,
      disc: d.disc,
      checks,
      allowPrivate: d.allowPrivate,
      now: new Date(now()).toISOString(),
    });
    cache = { at: now(), items: built };
    return built;
  }

  return { resources: async (q) => discoveryPage(await items(), q) };
}
