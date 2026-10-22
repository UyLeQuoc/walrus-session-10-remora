import { DiagnoseReport, HealthReport } from "@remora/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { diagnose } from "./diagnose.ts";
import { type HealthDeps, healthReport } from "./health.ts";
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
