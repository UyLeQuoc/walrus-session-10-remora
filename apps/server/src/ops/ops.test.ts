import { DiagnoseReport, HealthReport } from "@remora/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { diagnose, tatumTrouble } from "./diagnose.ts";
import { type HealthDeps, healthReport, publicStatus } from "./health.ts";
import {
  isOpsError,
  noteRelayerError,
  noteWatcher,
  recentErrors,
  recordError,
  resetSignals,
} from "./signals.ts";

const healthy = (o: Partial<HealthDeps> = {}): HealthDeps => ({
  networks: ["testnet"],
  db: async () => 1,
  tip: async () => 1_000,
  relayerHealth: async () => {},
  facilitator: async () => ({ sponsor: "0x5905" }),
  suiBalance: async () => 900_000_000n,
  queue: async () => ({ due: 0, oldestDueMs: null }),
  watcherOn: true,
  playground: async () => ({ usdc: 900_000n, sui: 100_000_000n }),
  timeoutMs: 200,
  ...o,
});

beforeEach(() => resetSignals());

describe("health report (K2, ADR-0052)", () => {
  it("is ok when every item is, and names the checkpoint lag", async () => {
    noteWatcher("testnet", { subscriptions: 2, checkpoint: 995 });
    const r = HealthReport.parse(await healthReport(healthy()));
    expect(r.status).toBe("ok");
    expect(r.items.map((i) => i.name)).toEqual([
      "database",
      "tatum (testnet)",
      "checkpoint lag (testnet)",
      "facilitator (testnet)",
      "sponsor gas (testnet)",
      "relayer",
      "relayer budget",
      "memory writes",
      "job queue",
      "playground funder",
    ]);
    expect(r.items.find((i) => i.name === "checkpoint lag (testnet)")?.value).toBe(5);
  });

  it("degrades on a recent relayer 429, low sponsor gas or a stuck queue, and fails on a dead database", async () => {
    noteWatcher("testnet", { subscriptions: 0 });
    noteRelayerError(new Error('relayer POST /api/stats → 429 {"error":"Rate limit exceeded"}'));
    const r = await healthReport(
      healthy({
        suiBalance: async () => 100_000_000n,
        queue: async () => ({ due: 4, oldestDueMs: 300_000 }),
        playground: async () => ({ usdc: 10_000n, sui: 100_000_000n }),
      }),
    );
    const by = (n: string) => r.items.find((i) => i.name === n);
    expect(by("checkpoint lag (testnet)")?.status).toBe("ok"); // nothing watched
    expect(by("relayer budget")).toMatchObject({ status: "degraded", value: "429" });
    expect(by("relayer budget")?.fix).toBeTruthy();
    expect(by("sponsor gas (testnet)")?.status).toBe("degraded");
    expect(by("job queue")?.status).toBe("degraded");
    expect(by("playground funder")?.status).toBe("degraded");
    expect(r.status).toBe("degraded");
    const dead = await healthReport(
      healthy({ db: async () => Promise.reject(new Error("refused")) }),
    );
    expect(dead.status).toBe("down");
    expect(dead.items[0]).toMatchObject({ name: "database", status: "down" });
  });

  it("reports memory failing behind a healthy /health, but not a 429 or an old failure", async () => {
    const now = Date.now();
    noteRelayerError(new Error("relayer POST /api/recall → 429"), now);
    let r = await healthReport(healthy({ now: () => now }));
    expect(r.items.find((i) => i.name === "memory writes")?.status).toBe("ok");

    noteRelayerError(
      new Error("write job failed: Embedding API error (401 Unauthorized)"),
      now - 11 * 60_000,
    );
    noteRelayerError(new Error('Walrus Memory server error (500): {"error":"traceId: t1"}'), now);
    r = await healthReport(healthy({ now: () => now }));
    expect(r.items.find((i) => i.name === "relayer")?.status).toBe("ok");
    const writes = r.items.find((i) => i.name === "memory writes");
    expect(writes).toMatchObject({ status: "degraded", value: 1 });
    expect(writes?.detail).toContain("traceId: t1");
    expect(writes?.fix).toContain("diagnose:memory");
  });

  it("times a slow probe out instead of hanging", async () => {
    const r = await healthReport(healthy({ relayerHealth: () => new Promise(() => {}) }));
    expect(r.items.find((i) => i.name === "relayer")).toMatchObject({
      status: "down",
      detail: "no answer in 200 ms",
    });
  });
});

describe("error ring and relayer signals (K1)", () => {
  it("groups errors by route and code, newest first", () => {
    recordError("POST /api/x", "relayer.slow", "slow", 1_000);
    recordError("POST /api/x", "relayer.slow", "slow again", 2_000);
    recordError("GET /api/y", "unknown", "boom", 1_500);
    expect(recentErrors()).toEqual([
      {
        route: "POST /api/x",
        code: "relayer.slow",
        message: "slow again",
        count: 2,
        lastAt: new Date(2_000).toISOString(),
      },
      {
        route: "GET /api/y",
        code: "unknown",
        message: "boom",
        count: 1,
        lastAt: new Date(1_500).toISOString(),
      },
    ]);
    expect(isOpsError("relayer.slow", 409)).toBe(true);
    expect(isOpsError("playground.no_questions", 409)).toBe(false);
    expect(isOpsError("anything", 500)).toBe(true);
  });
});

describe("diagnose, the deploy gate (K2)", () => {
  const base = {
    network: "testnet" as const,
    deployment: {
      remoraPackageId: "0xcc",
      discRegistryId: "0x47",
      hatcheryPackageId: "0x68",
      hatcheryRegistryId: "0xb3",
      memwalRelayer: "https://relayer",
    },
    tip: async () => 7,
    relayerConfig: async () => ({ packageId: "0xe7c1" }),
    delegates: async () => 2,
    walrus: { publisher: "https://pub", aggregator: "https://agg" },
    fetchStatus: async () => 200,
  };
  const types: Record<string, string> = {
    "0xcc": "package",
    "0x47": "0x00cc::disc::Registry",
    "0x68": "package",
    "0xb3": "0x68::hatchery::Registry",
  };

  it("passes when every id has the type the code expects", async () => {
    const r = DiagnoseReport.parse(
      await diagnose({ ...base, objectType: async (id) => types[id] ?? "?" }),
    );
    expect(r.ok).toBe(true);
    expect(r.items.every((i) => i.status === "ok")).toBe(true);
  });

  it("fails on a wrong or missing id and says how to fix it", async () => {
    const r = await diagnose({
      ...base,
      deployment: { ...base.deployment, discRegistryId: "0xb3", hatcheryPackageId: null },
      objectType: async (id) => types[id] ?? "?",
    });
    expect(r.ok).toBe(false);
    const disc = r.items.find((i) => i.name === "disc registry");
    expect(disc).toMatchObject({ status: "down" });
    expect(disc?.fix).toMatch(/DEPLOYMENTS\.testnet\.discRegistryId/);
    expect(r.items.find((i) => i.name === "hatchery package")?.detail).toBe("not set");
    const gone = await diagnose({
      ...base,
      objectType: async () => Promise.reject(new Error("Object not found")),
    });
    expect(gone.items[0]?.detail).toMatch(/doesn't exist on testnet/);
  });

  it("tells a Tatum out of credits apart from an id that doesn't exist", async () => {
    const r = await diagnose({
      ...base,
      objectType: async () => {
        throw new Error("Received HTTP status code 402");
      },
      tip: async () => {
        throw new Error("Received HTTP status code 402");
      },
    });
    expect(r.ok).toBe(false);
    const disc = r.items.find((i) => i.name === "disc registry");
    expect(disc?.detail).toMatch(/^couldn't check/);
    expect(disc?.fix).toMatch(/out of credits.*TATUM_API_KEY_TESTNET/);
    expect(r.items.find((i) => i.name === "tatum")?.fix).toMatch(/out of credits/);
    expect(tatumTrouble("Object 0x1 not found", "testnet")).toBeNull();
    expect(tatumTrouble("UNAUTHENTICATED: bad key", "mainnet")).toMatch(/TATUM_API_KEY\b/);
  });

  it("probes memory recall: the relayer's own failure warns, our key's failure gates", async () => {
    const run = (recall: () => Promise<boolean>) =>
      diagnose({ ...base, objectType: async (id) => types[id] ?? "?", recall });
    const fine = await run(async () => true);
    expect(fine.items.find((i) => i.name === "memory recall")?.status).toBe("ok");
    const relayer = await run(async () => {
      throw new Error('Walrus Memory server error (500): {"error":"Internal server error"}');
    });
    expect(relayer.items.find((i) => i.name === "memory recall")?.status).toBe("degraded");
    expect(relayer.ok).toBe(true);
    const ours = await run(async () => {
      throw new Error("Walrus Memory server error (401): bad signature");
    });
    expect(ours.items.find((i) => i.name === "memory recall")?.status).toBe("down");
    expect(ours.ok).toBe(false);
    const off = await run(async () => false);
    expect(off.items.some((i) => i.name === "memory recall")).toBe(false);
  });

  it("treats a flaky delegates route as a warning, not a gate", async () => {
    const r = await diagnose({
      ...base,
      objectType: async (id) => types[id] ?? "?",
      delegates: async () => Promise.reject(new Error("agents 502")),
      walrus: { publisher: null, aggregator: "https://agg" },
    });
    expect(r.ok).toBe(true);
    expect(r.status).toBe("degraded");
  });
});

describe("public status (N20, ADR-0076)", () => {
  it("carries names and statuses only", () => {
    const out = publicStatus({
      status: "degraded",
      items: [
        {
          name: "tatum.testnet",
          status: "degraded",
          detail: "slow: trace 7f3a",
          value: "2400 ms",
          threshold: "1500 ms",
          fix: "Check the Tatum dashboard.",
        },
        { name: "db", status: "ok", detail: "ok", value: null, threshold: null, fix: null },
      ],
    });
    expect(out).toEqual({
      status: "degraded",
      items: [
        { name: "tatum.testnet", status: "degraded" },
        { name: "db", status: "ok" },
      ],
    });
    expect(JSON.stringify(out)).not.toMatch(/trace|2400|dashboard/);
  });
});

describe("Tatum usage in health (ADR-0080)", () => {
  it("is ok at a month's pace and degraded past about 1,400 requests an hour", async () => {
    const at = async (n: number) =>
      (await healthReport(healthy({ tatumLastHour: () => n }))).items.find(
        (i) => i.name === "tatum usage",
      );
    expect((await at(300))?.status).toBe("ok");
    const hot = await at(15_000);
    expect(hot?.status).toBe("degraded");
    expect(hot?.fix).toMatch(/unfiltered stream/);
  });
});

describe("the public fullnode fallback in health (ADR-0097)", () => {
  it("degrades Tatum while calls go to the fallback, and says why", async () => {
    noteWatcher("testnet", { subscriptions: 2, checkpoint: 995 });
    const r = await healthReport(
      healthy({
        fallback: () => ({
          since: Date.parse("2026-11-02T04:00:00Z"),
          reason: "Received HTTP status code 402",
          calls: 12,
        }),
      }),
    );
    const tatum = r.items.find((i) => i.name === "tatum (testnet)");
    expect(tatum).toMatchObject({ status: "degraded", value: 12 });
    expect(tatum?.detail).toMatch(/402 since 04:00 UTC; 12 calls went to the public fullnode/);
    expect(tatum?.fix).toMatch(/out of credits/);
    expect(r.items.find((i) => i.name === "checkpoint lag (testnet)")?.status).toBe("ok");
  });
});
