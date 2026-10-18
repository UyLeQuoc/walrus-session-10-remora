/**
 * D8: hands each sponsored transaction its own sponsor gas coin. Two transactions built on the same
 * coin version can't both execute (the second fails, and an owned object signed twice can lock until
 * the epoch ends), so a coin stays held from `/gas` until its transaction settles or `holdMs` passes.
 * With every coin held, `take` waits up to `waitMs` before refusing (`sponsor.busy`).
 */
export interface GasCoin {
  objectId: string;
  version: string;
  digest: string;
  balance: string;
}

export class GasCoinPool {
  readonly #held = new Map<string, number>();

  constructor(
    private readonly o: {
      list: () => Promise<GasCoin[]>;
      /** A coin must cover the largest gas budget the sponsor allows. */
      minBalance: bigint;
      holdMs?: number;
      waitMs?: number;
      now?: () => number;
      sleep?: (ms: number) => Promise<void>;
    },
  ) {}

  async take(): Promise<Omit<GasCoin, "balance">> {
    const now = this.o.now ?? Date.now;
    const sleep = this.o.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    const deadline = now() + (this.o.waitMs ?? 15_000);
    for (;;) {
      const t = now();
      for (const [id, until] of this.#held) if (until <= t) this.#held.delete(id);
      const coin = (await this.o.list()).find(
        (c) => !this.#held.has(c.objectId) && BigInt(c.balance) >= this.o.minBalance,
      );
      if (coin) {
        this.#held.set(coin.objectId, t + (this.o.holdMs ?? 90_000));
        return { objectId: coin.objectId, version: coin.version, digest: coin.digest };
      }
      if (t >= deadline) return Promise.reject(new GasPoolBusy());
      await sleep(1_000);
    }
  }

  release(objectIds: string[]): void {
    for (const id of objectIds) this.#held.delete(id);
  }

  get held(): number {
    return this.#held.size;
  }
}

export class GasPoolBusy extends Error {
  readonly code = "sponsor.busy";
  constructor() {
    super("Every sponsor gas coin is in use; try again in a moment.");
  }
}
