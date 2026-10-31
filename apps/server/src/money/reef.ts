/**
 * E7 (minimal): the Reef directory of x402 services remoras may pay, per network. Discs list payees by
 * address; the Reef maps `reef:<slug>` to a URL and a `payTo` (spec §12.5).
 */
import type { SuiNetwork } from "@remora/chain";

export interface ReefEntry {
  ref: `reef:${string}`;
  slug: string;
  name: string;
  description: string;
  /** Path on the merchant host; `:id` is filled by the caller. */
  path: string;
  /** Smallest USDC units. */
  price: string;
}

export const REEF: ReefEntry[] = [
  {
    ref: "reef:sui-risk",
    slug: "sui-risk",
    name: "sui-risk",
    description: "Age, last change and upgrade authority of any Sui object or package.",
    path: "/sui-risk/:id",
    price: "10000",
  },
  {
    ref: "reef:odds",
    slug: "odds",
    name: "odds",
    description: "A cached sports-odds snapshot.",
    path: "/odds",
    price: "20000",
  },
  {
    ref: "reef:brief",
    slug: "brief",
    name: "brief",
    description: "A short summary of a text or a page.",
    path: "/brief",
    price: "10000",
  },
];

export interface ResolvedReef extends ReefEntry {
  url: string;
  payTo: string;
}

/** Resolves the Reef for a network from env: `MERCHANTS_URL[_TESTNET]`, `MERCHANT_PAYTO[_TESTNET]`. */
export function reefFor(
  env: Record<string, string | undefined>,
  network: SuiNetwork,
): ResolvedReef[] {
  const suffix = network === "testnet" ? "_TESTNET" : "";
  const base = (env[`MERCHANTS_URL${suffix}`] ?? env.MERCHANTS_URL ?? "").replace(/\/$/, "");
  const payTo = env[`MERCHANT_PAYTO${suffix}`];
  if (!base || !payTo) return [];
  return REEF.map((e) => ({ ...e, url: `${base}${e.path}`, payTo }));
}

export const reefRef = (s: string) => REEF.find((e) => e.ref === s || e.slug === s);

const MERCHANT_DOCS =
  "https://github.com/UyLeQuoc/walrus-session-10-remora/tree/main/apps/merchants#readme";

/** E7 (H4): how the directory page groups and links each service. */
const LISTING: Record<string, { category: string; docsUrl: string }> = {
  "sui-risk": { category: "Onchain risk", docsUrl: MERCHANT_DOCS },
  odds: { category: "Sports", docsUrl: MERCHANT_DOCS },
  brief: { category: "Summaries", docsUrl: MERCHANT_DOCS },
};

/** E7 `GET /api/reef/services`: one row per service with its `payTo` on this network. */
export function reefServices(resolved: ResolvedReef[]) {
  return resolved.flatMap((e) => {
    const l = LISTING[e.slug];
    return l
      ? [
          {
            name: e.name,
            category: l.category,
            priceUsdc: e.price,
            payTo: e.payTo,
            docsUrl: l.docsUrl,
          },
        ]
      : [];
  });
}
