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
  // ADR-0106: five more, each reading its source before the payment.
  {
    ref: "reef:wallet",
    slug: "wallet",
    name: "wallet",
    description: "What a Sui address holds, and the kinds of objects it owns.",
    path: "/wallet/:id",
    price: "10000",
  },
  {
    ref: "reef:walrus",
    slug: "walrus",
    name: "walrus",
    description: "Whether a Walrus blob can be read, its size and what kind of file it is.",
    path: "/walrus/:id",
    price: "5000",
  },
  {
    ref: "reef:github",
    slug: "github",
    name: "github",
    description: "A GitHub repo's health: stars, issues, license, last push.",
    path: "/github/:owner/:repo",
    price: "10000",
  },
  {
    ref: "reef:price",
    slug: "price",
    name: "price",
    description: "SUI, WAL, BTC and ETH in USD, with the source and time.",
    path: "/price",
    price: "5000",
  },
  {
    ref: "reef:weather",
    slug: "weather",
    name: "weather",
    description: "A city's next three days.",
    path: "/weather",
    price: "5000",
  },
];

/** ADR-0094: a service by its name, as the web's `payeeName()` shows it, not its `reef:` id. */
const LABELS: Record<string, string> = {
  "reef:sui-risk": "Sui risk check",
  "reef:odds": "Odds",
  "reef:brief": "Brief",
  "reef:wallet": "Wallet X-ray",
  "reef:walrus": "Walrus blob check",
  "reef:github": "Repo health",
  "reef:price": "Prices",
  "reef:weather": "Weather",
};

export function payeeLabel(ref: string): string {
  return LABELS[ref] ?? ref.replace(/^reef:/, "");
}

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
  wallet: { category: "Onchain", docsUrl: MERCHANT_DOCS },
  walrus: { category: "Storage", docsUrl: MERCHANT_DOCS },
  github: { category: "Code", docsUrl: MERCHANT_DOCS },
  price: { category: "Markets", docsUrl: MERCHANT_DOCS },
  weather: { category: "Everyday", docsUrl: MERCHANT_DOCS },
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
