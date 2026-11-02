/**
 * N15 (ADR-0076): the SUI price in USD from Tatum's Data API (`/v4/data/rate/symbol`), for the
 * sponsored gas line of the cost card. One fetch per `ttlMs`, shared by every caller. When Tatum can't
 * answer (402 once the plan is spent), a public price stands in (ADR-0097). A failed fetch keeps
 * serving the last price; with no price yet, it throws.
 */
const RATE_URL = "https://api.tatum.io/v4/data/rate/symbol?symbol=SUI&basePair=USD";
const PUBLIC_RATE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd";

export class RateUnavailable extends Error {
  readonly code = "rate.unavailable";
}

export function createSuiUsd(o: {
  apiKey: string | undefined;
  /** Where the price comes from when Tatum can't answer; null: nowhere. */
  publicUrl?: string | null;
  fetch?: typeof fetch;
  ttlMs?: number;
  now?: () => number;
}): () => Promise<number> {
  const http = o.fetch ?? fetch;
  const ttl = o.ttlMs ?? 10 * 60_000;
  const now = o.now ?? Date.now;
  let last: { at: number; usd: number } | null = null;
  let inflight: Promise<number> | null = null;

  const publicUrl = o.publicUrl === undefined ? PUBLIC_RATE_URL : o.publicUrl;

  async function fromTatum(): Promise<number> {
    if (!o.apiKey) throw new RateUnavailable("No Tatum key, so no SUI price.");
    const res = await http(RATE_URL, {
      headers: { "x-api-key": o.apiKey },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new RateUnavailable(`Tatum's rate API answered ${res.status}.`);
    const body = (await res.json()) as { value?: unknown };
    const usd = Number(body.value);
    if (!Number.isFinite(usd) || usd <= 0) throw new RateUnavailable("Tatum sent no SUI price.");
    return usd;
  }

  async function fromPublic(url: string): Promise<number> {
    const res = await http(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) throw new RateUnavailable(`The public price answered ${res.status}.`);
    const body = (await res.json()) as { sui?: { usd?: unknown } };
    const usd = Number(body.sui?.usd);
    if (!Number.isFinite(usd) || usd <= 0) throw new RateUnavailable("The public price sent none.");
    return usd;
  }

  async function load(): Promise<number> {
    let usd: number;
    try {
      usd = await fromTatum();
    } catch (err) {
      if (!publicUrl) throw err;
      // Tatum's reason is the one to report: the public price is only a stand-in.
      usd = await fromPublic(publicUrl).catch(() => {
        throw err;
      });
    }
    last = { at: now(), usd };
    return usd;
  }

  return async () => {
    if (last && now() - last.at < ttl) return last.usd;
    inflight ??= load().finally(() => {
      inflight = null;
    });
    try {
      return await inflight;
    } catch (err) {
      if (last) return last.usd;
      throw err instanceof RateUnavailable ? err : new RateUnavailable((err as Error).message);
    }
  };
}
