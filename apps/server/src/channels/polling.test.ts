import { describe, expect, it } from "vitest";
import { describePollingError, keepPolling } from "./polling.ts";

const conflict = Object.assign(new Error("Call to 'getUpdates' failed! (409: Conflict)"), {
  error_code: 409,
});

function harness(outcomes: Array<Error | "ok">, stopAfter = Number.POSITIVE_INFINITY) {
  const slept: number[] = [];
  const logs: string[] = [];
  let calls = 0;
  let clock = 0;
  const done = keepPolling({
    start: async () => {
      const o = outcomes[calls++] ?? "ok";
      if (o !== "ok") throw o;
    },
    stopped: () => calls >= stopAfter,
    sleep: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
    log: (l) => logs.push(l),
    now: () => clock,
  });
  return { done, slept, logs, calls: () => calls };
}

describe("keepPolling", () => {
  it("survives the 409 a deploy overlap causes, and keeps polling", async () => {
    const h = harness([conflict, conflict, "ok"]);
    await expect(h.done).resolves.toBeUndefined();
    expect(h.calls()).toBe(3);
    expect(h.slept).toEqual([5_000, 10_000]);
    expect(h.logs[0]).toBe(
      "[telegram] polling stopped: another process is polling this bot (409); retrying in 5s",
    );
  });

  it("backs off to a minute and no further", async () => {
    const h = harness(Array(8).fill(conflict));
    await h.done;
    expect(h.slept).toEqual([5_000, 10_000, 20_000, 40_000, 60_000, 60_000, 60_000, 60_000]);
  });

  it("stops retrying once the adapter is stopped", async () => {
    const h = harness([conflict, conflict, conflict], 2);
    await h.done;
    expect(h.calls()).toBe(2);
  });

  it("never rejects, whatever start throws", async () => {
    const h = harness([new Error("socket hang up"), "ok"]);
    await expect(h.done).resolves.toBeUndefined();
    expect(h.logs[0]).toContain("socket hang up");
  });
});

describe("describePollingError", () => {
  it("names the two errors grammY rethrows", () => {
    expect(describePollingError(conflict)).toBe("another process is polling this bot (409)");
    expect(describePollingError({ error_code: 401 })).toBe("Telegram refused the token (401)");
  });
});
