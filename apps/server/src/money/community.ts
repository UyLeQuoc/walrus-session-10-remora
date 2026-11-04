/**
 * E8 (ADR-0111, ADR-0113): an owner lists an x402 API in the Reef. The server probes it with one
 * unpaid GET, which must answer a 402 for `sui:testnet`, the exact scheme, USDC, a `payTo` and a
 * price. The owner signs a message naming exactly what was found. The listing lives in one of the
 * owner's remoras' config (`listings`), so there's no schema push.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";
import { isPrivateAddress } from "@remora/merchant";
import { RemoraError } from "../runtime/remoras.ts";
import { SALE_SLUG } from "./listings.ts";

/** What a community API may charge for one call: 0.1 USDC. */
export const COMMUNITY_MAX_PRICE = 100_000n;
/** At most this many listings per owner. */
export const COMMUNITY_PER_OWNER = 5;

export interface Probe {
  url: string;
  payTo: string;
  /** Smallest USDC units per call. */
  price: string;
  description: string;
}

export interface CommunityListing extends Probe {
  slug: string;
  blurb: string;
  network: "testnet";
  lister: string;
  probedAt: string;
  message: string;
  signature: string;
}

export function listingsOf(config: unknown): CommunityListing[] {
  const raw = (config as { listings?: unknown } | null)?.listings;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (l): l is CommunityListing =>
      !!l &&
      typeof l === "object" &&
      typeof (l as CommunityListing).slug === "string" &&
      SALE_SLUG.test((l as CommunityListing).slug) &&
      typeof (l as CommunityListing).url === "string" &&
      typeof (l as CommunityListing).payTo === "string",
  );
}

/** The exact words the owner signs: what the probe found, and who lists it. */
export function listingMessage(p: Probe & { slug: string; lister: string }): string {
  return [
    "List an API in the Remora Reef (Sui testnet).",
    "",
    `Name: @${p.slug}`,
    `URL: ${p.url}`,
    `Price: ${p.price} (USDC, smallest units) a call`,
    `Paid to: ${p.payTo}`,
    `Listed by: ${p.lister}`,
    "",
    "This signs nothing else: no transaction, no spending.",
  ].join("\n");
}

/** One unpaid GET. Public https only when `allowPrivate` is off (any deployed host). */
export async function probeX402(
  url: string,
  o: {
    usdc: string;
    allowPrivate: boolean;
    fetch?: typeof fetch;
    resolve?: (host: string) => Promise<string[]>;
  },
): Promise<Probe> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new RemoraError("listing.bad_url", "That isn't a URL.");
  }
  if (u.protocol !== "https:" && !(o.allowPrivate && u.protocol === "http:"))
    throw new RemoraError("listing.bad_url", "List an https URL.");
  if (u.username || u.password)
    throw new RemoraError("listing.bad_url", "A listed URL can't carry a password.");
  if (!o.allowPrivate) {
    const host = u.hostname.replace(/^\[|\]$/g, "");
    const resolve =
      o.resolve ?? (async (h: string) => (await lookup(h, { all: true })).map((a) => a.address));
    const addresses = isIP(host) ? [host] : await resolve(host).catch(() => []);
    if (!addresses.length || addresses.some(isPrivateAddress))
      throw new RemoraError("listing.private", "List an API on a public address.");
  }
  let res: Response;
  try {
    res = await (o.fetch ?? fetch)(u, { redirect: "manual", signal: AbortSignal.timeout(8_000) });
  } catch {
    throw new RemoraError("listing.unreachable", "That URL didn't answer.");
  }
  if (res.status !== 402)
    throw new RemoraError(
      "listing.not_x402",
      `That URL answered ${res.status}, not 402: it doesn't ask to be paid.`,
    );
  const body = (await res.json().catch(() => null)) as {
    accepts?: {
      scheme?: string;
      network?: string;
      asset?: string;
      payTo?: string;
      amount?: string;
      description?: string;
    }[];
  } | null;
  const offer = (body?.accepts ?? []).find(
    (a) => a.scheme === "exact" && a.network === "sui:testnet" && a.asset === o.usdc,
  );
  if (!offer)
    throw new RemoraError("listing.no_offer", "Its 402 has no exact USDC payment on sui:testnet.");
  if (!offer.payTo || !isValidSuiAddress(normalizeSuiAddress(offer.payTo)))
    throw new RemoraError("listing.no_offer", "Its 402 doesn't name a Sui address to pay.");
  if (!/^\d{1,12}$/.test(offer.amount ?? "") || BigInt(offer.amount ?? "0") === 0n)
    throw new RemoraError("listing.no_offer", "Its 402 doesn't name a price.");
  if (BigInt(offer.amount ?? "0") > COMMUNITY_MAX_PRICE)
    throw new RemoraError("listing.too_dear", "List APIs of 0.1 USDC a call or less.");
  return {
    url: `${u.origin}${u.pathname}`,
    payTo: normalizeSuiAddress(offer.payTo),
    price: offer.amount ?? "0",
    description: String(offer.description ?? "").slice(0, 140),
  };
}
