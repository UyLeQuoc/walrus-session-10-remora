/**
 * ADR-0106 `price` source, shared since ADR-0121: token prices in USD from CoinGecko's public API (no
 * key). The house `price` merchant sells it; the server's price trigger reads it unpaid. A minute's
 * cache keeps the public rate limit away.
 */

/** The tokens it prices, by the symbols people write, with CoinGecko's ids. */
export const TOKENS: Record<string, { id: string; name: string }> = {
  SUI: { id: "sui", name: "Sui" },
  WAL: { id: "walrus-2", name: "Walrus" },
  BTC: { id: "bitcoin", name: "Bitcoin" },
  ETH: { id: "ethereum", name: "Ether" },
};
const ALIASES: Record<string, string> = {
  WALRUS: "WAL",
  BITCOIN: "BTC",
  ETHER: "ETH",
  ETHEREUM: "ETH",
};

/** The `TOKENS` symbol a word names ("walrus" → WAL), or null. */
export function tokenSymbol(word: string): string | null {
  const w = word.trim().toUpperCase();
  const symbol = ALIASES[w] ?? w;
  return symbol in TOKENS ? symbol : null;
}

/** The symbols a query names (`SUI,WAL` or free text); all of them when it names none. */
export function symbolsIn(query: string): string[] {
  const words = query.toUpperCase().match(/[A-Z]{3,8}/g) ?? [];
  const named = [...new Set(words.map((w) => ALIASES[w] ?? w).filter((w) => w in TOKENS))];
  return named.length ? named : Object.keys(TOKENS);
}

export interface Prices {
  source: "CoinGecko";
  prices: { symbol: string; name: string; usd: number; pricedAt: string }[];
}

const cache = new Map<string, { at: number; value: Prices }>();

export async function pricesOf(symbols: string[], http: typeof fetch = fetch, now = Date.now()) {
  const key = symbols.join(",");
  const hit = cache.get(key);
  if (hit && now - hit.at < 60_000) return hit.value;
  const ids = symbols.map((s) => TOKENS[s]?.id).filter(Boolean);
  const res = await http(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_last_updated_at=true`,
  );
  if (!res.ok) throw new Error(`CoinGecko answered ${res.status}`);
  const body = (await res.json()) as Record<string, { usd?: number; last_updated_at?: number }>;
  const prices = symbols.flatMap((symbol) => {
    const t = TOKENS[symbol];
    const row = t ? body[t.id] : undefined;
    return t && typeof row?.usd === "number"
      ? [
          {
            symbol,
            name: t.name,
            usd: row.usd,
            pricedAt: new Date((row.last_updated_at ?? now / 1000) * 1000).toISOString(),
          },
        ]
      : [];
  });
  if (!prices.length) throw new Error("CoinGecko returned no price");
  const value: Prices = { source: "CoinGecko", prices };
  cache.set(key, { at: now, value });
  return value;
}
