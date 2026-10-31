/**
 * N15 (ADR-0076): the SUI price in USD from Tatum's Data API (`/v4/data/rate/symbol`), for the
 * sponsored gas line of the cost card. One fetch per `ttlMs`, shared by every caller. A failed fetch
 * keeps serving the last price; with no price yet, it throws.
 */
const RATE_URL = "https://api.tatum.io/v4/data/rate/symbol?symbol=SUI&basePair=USD";

export class RateUnavailable extends Error {
  readonly code = "rate.unavailable";
}

export function createSuiUsd(o: {
  apiKey: string | undefined;
  fetch?: typeof fetch;
  ttlMs?: number;
  now?: () => number;
}): () => Promise<number> {
  const http = o.fetch ?? fetch;
  const ttl = o.ttlMs ?? 10 * 60_000;
  const now = o.now ?? Date.now;
  let last: { at: number; usd: number } | null = null;
  let inflight: Promise<number> | null = null;

  async function load(): Promise<number> {
    if (!o.apiKey) throw new RateUnavailable("No Tatum key, so no SUI price.");
    const res = await http(RATE_URL, {
      headers: { "x-api-key": o.apiKey },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new RateUnavailable(`Tatum's rate API answered ${res.status}.`);
    const body = (await res.json()) as { value?: unknown };
    const usd = Number(body.value);
    if (!Number.isFinite(usd) || usd <= 0) throw new RateUnavailable("Tatum sent no SUI price.");
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
