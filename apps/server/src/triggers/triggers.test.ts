import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { describe, expect, it, vi } from "vitest";
import { human, nextRun } from "./cron.ts";
import { parseSchedule, previewSchedule } from "./schedule.ts";
import {
  decimalsOf,
  eventsFrom,
  filterFor,
  groupsOf,
  MAX_FILTER_LITERALS,
  MAX_STREAMS,
  startWatcher,
} from "./watch.ts";

describe("cron (D1, N12)", () => {
  const from = new Date("2026-10-19T08:30:15Z"); // a Monday
  it("finds the next matching minute in UTC", () => {
    expect(nextRun("0 9 * * *", from)?.toISOString()).toBe("2026-10-19T09:00:00.000Z");
    expect(nextRun("*/15 * * * *", from)?.toISOString()).toBe("2026-10-19T08:45:00.000Z");
    expect(nextRun("0 9 * * 1", new Date("2026-10-19T09:00:00Z"))?.toISOString()).toBe(
      "2026-10-26T09:00:00.000Z",
    );
    expect(nextRun("30 8 1 * *", from)?.toISOString()).toBe("2026-11-01T08:30:00.000Z");
    expect(nextRun("0 9,17 * * 1-5", new Date("2026-10-23T18:00:00Z"))?.toISOString()).toBe(
      "2026-10-26T09:00:00.000Z",
    );
  });
  it("rejects malformed expressions", () => {
    expect(nextRun("0 9 * *", from)).toBeNull();
    expect(nextRun("99 * * * *", from)).toBeNull();
  });
  it("says schedules in words", () => {
    expect(human("0 9 * * 1")).toBe("every Monday at 9am UTC");
    expect(human("30 18 * * *")).toBe("every day at 6:30pm UTC");
    expect(human("*/5 * * * *")).toBe("every 5 minutes");
    expect(human("5 4 1 * *")).toBe("5 4 1 * *");
  });
});

describe("chain watcher (D1 chain)", () => {
  const me = normalizeSuiAddress("0xa");
  it("turns watched balance changes into events", () => {
    const events = eventsFrom(
      {
        transactions: [
          {
            digest: "Dg1",
            balanceChanges: [
              { address: "0xa", coinType: "0x2::sui::SUI", amount: "-5000000" },
              { address: "0xb", coinType: "0x2::sui::SUI", amount: "5000000" },
              { address: "0xa", coinType: "0xa1ec::usdc::USDC", amount: "0" },
            ],
          },
          {
            digest: "Dg2",
            balanceChanges: [{ address: "0xa", coinType: "0xa1ec::usdc::USDC", amount: "2500000" }],
          },
        ],
      },
      new Set([me]),
    );
    expect(events).toEqual([
      {
        address: me,
        direction: "out",
        coinType: "0x2::sui::SUI",
        amount: 5_000_000n,
        decimals: 9,
        digest: "Dg1",
      },
      {
        address: me,
        direction: "in",
        coinType: "0xa1ec::usdc::USDC",
        amount: 2_500_000n,
        decimals: 6,
        digest: "Dg2",
      },
    ]);
    expect(decimalsOf("0x2::sui::SUI")).toBe(9);
  });
});

describe("human schedules (N12)", () => {
  const from = new Date("2026-10-19T08:30:00Z"); // a Monday
  it("turns phrases into cron", () => {
    expect(parseSchedule("weekdays at 8am")).toBe("0 8 * * 1-5");
    expect(parseSchedule("every Sunday evening")).toBe("0 18 * * 0");
    expect(parseSchedule("every day at 18:30")).toBe("30 18 * * *");
    expect(parseSchedule("daily")).toBe("0 9 * * *");
    expect(parseSchedule("every 2 hours")).toBe("0 */2 * * *");
    expect(parseSchedule("every 15 minutes")).toBe("*/15 * * * *");
    expect(parseSchedule("mon and wed at 7pm")).toBe("0 19 * * 1,3");
    expect(parseSchedule("0 9 * * 1")).toBe("0 9 * * 1");
    expect(parseSchedule("whenever you feel like it")).toBeNull();
    expect(parseSchedule("every 1 minutes")).toBeNull();
  });
  it("previews the next runs in words", () => {
    expect(previewSchedule("weekdays at 8am", from)).toEqual({
      cron: "0 8 * * 1-5",
      human: "weekdays at 8am UTC",
      next: ["2026-10-20T08:00:00.000Z", "2026-10-21T08:00:00.000Z", "2026-10-22T08:00:00.000Z"],
    });
    expect(human("0 19 * * 1,3")).toBe("every Monday and Wednesday at 7pm UTC");
    expect(human("0 */2 * * *")).toBe("every 2 hours");
  });
});

describe("chain watcher filter", () => {
  const addrs = (n: number) =>
    Array.from({ length: n }, (_, i) => normalizeSuiAddress(`0x${i + 1}`));

  it("filters by address up to the node's 10 literals, and never builds an unfiltered stream", () => {
    expect(filterFor(addrs(MAX_FILTER_LITERALS)).terms).toHaveLength(10);
    expect(() => filterFor(addrs(MAX_FILTER_LITERALS + 1))).toThrow(/at most 10/);
    expect(groupsOf(addrs(25)).groups.map((g) => g.length)).toEqual([10, 10, 5]);
    const many = groupsOf(addrs(MAX_FILTER_LITERALS * MAX_STREAMS + 3));
    expect(many.groups).toHaveLength(MAX_STREAMS);
    expect(many.dropped).toBe(3);
  });

  it("opens one filtered stream per 10 addresses, and restarts them all when one fails (ADR-0058)", async () => {
    const watched = addrs(13);
    const filters: number[][] = [];
    let opened = 0;
    const client = {
      subscriptionService: {
        subscribeCheckpoints: (
          req: {
            filter?: {
              terms: { literals: { predicate: { affectedAddress: { address: string } } }[] }[];
            };
          },
          opts: { abort: AbortSignal },
        ) => {
          opened += 1;
          const mine = (req.filter?.terms ?? []).map((t) =>
            watched.indexOf(t.literals[0]?.predicate.affectedAddress.address ?? ""),
          );
          filters.push(mine);
          const round = Math.ceil(opened / 2);
          const breaks = round === 1 && mine.includes(12);
          return {
            responses: (async function* () {
              const target = watched[mine[0] ?? 0] ?? "";
              yield {
                cursor: BigInt(10 * round),
                checkpoint: {
                  transactions: [
                    {
                      digest: `Dg${round}-${mine[0]}`,
                      balanceChanges: [{ address: target, coinType: "0x2::sui::SUI", amount: "5" }],
                    },
                  ],
                },
              };
              if (breaks) throw new Error("stream reset");
              await new Promise((_, reject) =>
                opts.abort.addEventListener("abort", () => reject(new Error("aborted"))),
              );
            })(),
          };
        },
      },
      ledgerService: {
        getCheckpoint: async () => ({ response: { checkpoint: { transactions: [] } } }),
      },
    };
    const seen: string[] = [];
    const stop = startWatcher({
      network: "testnet",
      client: client as never,
      db: {} as never,
      log: createLogger({}, () => {}),
      watched: async () => [{ remoraId: "r1", addresses: watched }],
      onEvent: async (_id, e) => void seen.push(e.digest),
      reconnectMs: 1,
    });
    await vi.waitFor(() => expect(opened).toBeGreaterThanOrEqual(4));
    stop();
    // Every stream carried a filter: 10 addresses, then 3. Never an unfiltered one.
    expect(
      filters
        .slice(0, 2)
        .map((f) => f.length)
        .sort(),
    ).toEqual([10, 3]);
    expect(filters.every((f) => f.length > 0)).toBe(true);
    expect(seen).toEqual(expect.arrayContaining(["Dg1-0", "Dg1-10", "Dg2-0", "Dg2-10"]));
  });
});

describe("chain watcher reconnects without losing events", () => {
  it("backfills the checkpoints between the last frame and the new stream", async () => {
    const watched = normalizeSuiAddress("0xa");
    const change = (digest: string, amount: string) => ({
      digest,
      balanceChanges: [{ address: watched, coinType: "0x2::sui::SUI", amount }],
    });
    let subscriptions = 0;
    const fetched: bigint[] = [];
    const client = {
      subscriptionService: {
        subscribeCheckpoints: () => {
          subscriptions += 1;
          const first = subscriptions === 1;
          return {
            responses: (async function* () {
              if (first) {
                yield { cursor: 10n, checkpoint: { transactions: [change("Dg10", "5")] } };
                throw new Error("stream reset");
              }
              yield { cursor: 14n, checkpoint: { transactions: [change("Dg14", "7")] } };
              await new Promise(() => {}); // stays open
            })(),
          };
        },
      },
      ledgerService: {
        getCheckpoint: async ({ checkpointId }: { checkpointId: { sequenceNumber: bigint } }) => {
          fetched.push(checkpointId.sequenceNumber);
          const s = checkpointId.sequenceNumber;
          return {
            response: { checkpoint: { transactions: s === 12n ? [change("Dg12", "9")] : [] } },
          };
        },
      },
    };
    const seen: string[] = [];
    const stop = startWatcher({
      network: "testnet",
      client: client as never,
      db: {} as never,
      log: createLogger({}, () => {}),
      watched: async () => [{ remoraId: "r1", addresses: [watched] }],
      onEvent: async (_id, e) => void seen.push(e.digest),
      reconnectMs: 1,
    });
    await vi.waitFor(() => expect(seen).toEqual(["Dg10", "Dg12", "Dg14"]));
    expect(fetched).toEqual([11n, 12n, 13n]);
    stop();
  });

  it("doesn't backfill when it re-subscribes because the watched set changed (ADR-0080)", async () => {
    const a = normalizeSuiAddress("0xa");
    const b = normalizeSuiAddress("0xb");
    let subscriptions = 0;
    const fetched: bigint[] = [];
    let set = [a];
    const client = {
      subscriptionService: {
        subscribeCheckpoints: (_req: unknown, opts: { abort: AbortSignal }) => {
          subscriptions += 1;
          const n = subscriptions;
          return {
            responses: (async function* () {
              yield { cursor: n === 1 ? 10n : 20n, checkpoint: { transactions: [] } };
              if (n === 1) set = [a, b]; // a new Sentinel arrives
              await new Promise((r) => opts.abort.addEventListener("abort", r)); // open until aborted
            })(),
          };
        },
      },
      ledgerService: {
        getCheckpoint: async ({ checkpointId }: { checkpointId: { sequenceNumber: bigint } }) => {
          fetched.push(checkpointId.sequenceNumber);
          return { response: { checkpoint: { transactions: [] } } };
        },
      },
    };
    const stop = startWatcher({
      network: "testnet",
      client: client as never,
      db: {} as never,
      log: createLogger({}, () => {}),
      watched: async () => [{ remoraId: "r1", addresses: set }],
      onEvent: async () => {},
      reconnectMs: 1,
      refreshMs: 5,
    });
    await vi.waitFor(() => expect(subscriptions).toBe(2));
    await new Promise((r) => setTimeout(r, 20));
    expect(fetched).toEqual([]);
    stop();
  });
});
