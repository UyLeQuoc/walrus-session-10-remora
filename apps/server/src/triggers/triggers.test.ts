import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { describe, expect, it, vi } from "vitest";
import { human, nextRun } from "./cron.ts";
import { parseSchedule, previewSchedule } from "./schedule.ts";
import { decimalsOf, eventsFrom, startWatcher } from "./watch.ts";

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
});
