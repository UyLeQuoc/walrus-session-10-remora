/**
 * E11 (ADR-0111, ADR-0112): remoras on sale, listed in the Reef next to the house services.
 * - A listing is `reef:remora-<slug>`, so the ReefRef contract, Wakes and Disc payees stay as they are.
 * - It's paid at its owner's address, at `/api/x402/r/<slug>`.
 * - It lives in the remora's config (`sell`), so there's no schema change.
 * The list is cached per network and refreshed on a timer and whenever an owner changes a sale.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { Logger, SuiNetwork } from "@remora/chain";
import { type Db, ne, remoras } from "@remora/db";
import { listingsOf } from "./community.ts";
import type { ResolvedReef } from "./reef.ts";

export interface Sale {
  on: boolean;
  slug: string;
  /** Smallest USDC units per answer. */
  price: string;
  blurb: string;
}

export const SALE_SLUG = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
/** 0.005–0.05 USDC an answer. */
export const SALE_PRICE = { min: 5_000n, max: 50_000n } as const;
export const REMORA_REF_PREFIX = "reef:remora-";
/** ADR-0113: an API an owner listed. */
export const COMMUNITY_REF_PREFIX = "reef:community-";

export const saleRef = (slug: string) => `${REMORA_REF_PREFIX}${slug}` as const;
export const isRemoraRef = (ref: string) => ref.startsWith(REMORA_REF_PREFIX);
export const isCommunityRef = (ref: string) => ref.startsWith(COMMUNITY_REF_PREFIX);
export const salePath = (slug: string) => `/api/x402/r/${slug}`;

export function saleOf(config: unknown): Sale | null {
  const s = (config as { sell?: Partial<Sale> } | null)?.sell;
  if (!s || typeof s.slug !== "string" || !SALE_SLUG.test(s.slug)) return null;
  return {
    on: s.on === true,
    slug: s.slug,
    price: String(s.price ?? ""),
    blurb: String(s.blurb ?? ""),
  };
}

export interface Listing extends ResolvedReef {
  kind: "remora" | "community";
  /** The remora on sale, or the remora whose config holds the community listing. */
  sellerId: string;
  /** The seller's owner, or who listed the API. */
  owner: string;
  remoraName: string;
}

export interface Listings {
  /** The listings on this network, for the Reef. */
  entries(network: SuiNetwork): Listing[];
  bySlug(network: SuiNetwork, slug: string): Listing | undefined;
  /** ADR-0113: a community listing by its name. */
  communityBySlug(network: SuiNetwork, slug: string): Listing | undefined;
  /** Whether a name is taken by a remora on sale or a listed API, on any network. */
  taken(slug: string): boolean;
  refresh(): Promise<void>;
  /** Refreshes every `ms`; returns the stop function. */
  start(ms?: number): () => void;
}

export function createListings(o: { db: Db; base: string; log: Logger }): Listings {
  const base = o.base.replace(/\/$/, "");
  let cache = new Map<SuiNetwork, Listing[]>();

  async function refresh() {
    const rows = await o.db.select().from(remoras).where(ne(remoras.status, "retired"));
    const next = new Map<SuiNetwork, Listing[]>();
    for (const r of rows) {
      const network = r.network as SuiNetwork;
      for (const l of listingsOf(r.config)) {
        const list = next.get(network) ?? [];
        const u = new URL(l.url);
        list.push({
          kind: "community",
          ref: `${COMMUNITY_REF_PREFIX}${l.slug}`,
          slug: `community-${l.slug}`,
          name: `@${l.slug}`,
          description: l.blurb || l.description || "An API an owner listed",
          path: u.pathname,
          price: l.price,
          url: l.url,
          payTo: normalizeSuiAddress(l.payTo),
          sellerId: r.id,
          owner: normalizeSuiAddress(l.lister),
          remoraName: r.name,
        });
        next.set(network, list);
      }
      if (r.status !== "active") continue;
      const s = saleOf(r.config);
      if (!s?.on) continue;
      const price = BigInt(/^\d+$/.test(s.price) ? s.price : "0");
      if (price < SALE_PRICE.min || price > SALE_PRICE.max) continue;
      const list = next.get(network) ?? [];
      list.push({
        kind: "remora",
        ref: saleRef(s.slug),
        slug: `remora-${s.slug}`,
        name: `@${s.slug}`,
        description: s.blurb || `${r.name}'s answers`,
        path: salePath(s.slug),
        price: price.toString(),
        url: `${base}${salePath(s.slug)}`,
        payTo: normalizeSuiAddress(r.ownerAddress),
        sellerId: r.id,
        owner: normalizeSuiAddress(r.ownerAddress),
        remoraName: r.name,
      });
      next.set(network, list);
    }
    cache = next;
  }

  return {
    entries: (network) => cache.get(network) ?? [],
    bySlug: (network, slug) => (cache.get(network) ?? []).find((l) => l.slug === `remora-${slug}`),
    communityBySlug: (network, slug) =>
      (cache.get(network) ?? []).find((l) => l.slug === `community-${slug}`),
    taken: (slug) =>
      [...cache.values()].some((list) =>
        list.some((l) => l.slug === `remora-${slug}` || l.slug === `community-${slug}`),
      ),
    refresh,
    start(ms = 30_000) {
      const tick = () =>
        refresh().catch((err) => o.log.warn("listings.refresh_failed", { error: err }));
      void tick();
      const t = setInterval(tick, ms);
      t.unref?.();
      return () => clearInterval(t);
    },
  };
}
