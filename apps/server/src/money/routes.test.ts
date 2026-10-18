import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { createLogger } from "@remora/chain";
import { DetectFundsResult } from "@remora/schema";
import { describe, expect, it } from "vitest";
import { createNetworks, NETWORK_HEADER, resolveNetwork } from "./networks.ts";
import { createMoneyRoutes } from "./routes.ts";

const PKG = `0x${"cc".repeat(32)}`;
const USDC = "0xa1ec::usdc::USDC";
const OWNER = `0x${"0f".repeat(32)}`;
const REMORA = `0x${"05".repeat(32)}`;
const COIN = `0x${"c0".repeat(32)}`;

const deployments = {
  mainnet: { remoraPackageId: null, discRegistryId: null, usdcCoinType: "0xdba::usdc::USDC" },
  testnet: { remoraPackageId: PKG, discRegistryId: `0x${"47".repeat(32)}`, usdcCoinType: USDC },
};

const fakeClient = {
  core: {
    getBalance: async ({ owner }: { owner: string }) => ({
      balance: {
        coinType: USDC,
        balance: owner === OWNER ? "1500" : "0",
        addressBalance: owner === OWNER ? "1000" : "0",
        coinBalance: owner === OWNER ? "500" : "0",
      },
    }),
    listCoins: async () => ({ objects: [{ objectId: COIN }], hasNextPage: false, cursor: null }),
  },
} as unknown as SuiGrpcClient;

type Body = {
  default: string;
  network: string;
  networks: Record<string, unknown>[];
  error: { code: string };
  splits: unknown;
  movable: unknown;
  transaction: string;
};
const json = async (r: Response) => (await r.json()) as Body;

const silent = createLogger({}, () => {});
const networks = createNetworks(
  { SUI_NETWORK: "mainnet", TATUM_API_KEY: "m", TATUM_API_KEY_TESTNET: "t" },
  deployments,
  () => fakeClient,
);
const app = createMoneyRoutes({ networks, log: silent });

describe("networks (ADR-0026)", () => {
  it("only lists a network as available once it's published and keyed", () => {
    expect(networks.list().map((n) => [n.network, n.available])).toEqual([
      ["testnet", true],
      ["mainnet", false],
    ]);
    expect(networks.config("mainnet").reason).toMatch(/isn't published on mainnet/);
  });

  it("falls back to the first available network when the preferred one is off", () => {
    expect(networks.default).toBe("testnet");
  });

  it("refuses unknown and unavailable networks", () => {
    expect(resolveNetwork(networks, undefined)).toBe("testnet");
    expect(resolveNetwork(networks, "testnet")).toBe("testnet");
    expect(() => resolveNetwork(networks, "mainnet")).toThrow(/mainnet is unavailable/);
    expect(() => resolveNetwork(networks, "devnet")).toThrow(/unknown network/);
    expect(() => networks.client("mainnet")).toThrow(/unavailable/);
  });

  it("treats a missing Tatum key as unavailable", () => {
    const n = createNetworks({}, deployments, () => fakeClient);
    expect(n.config("testnet")).toMatchObject({
      available: false,
      reason: "no Tatum key for testnet",
    });
  });
});

describe("money routes", () => {
  it("GET /api/networks reports availability", async () => {
    const res = await app.request("/api/networks");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.default).toBe("testnet");
    expect(body.networks[1]).toMatchObject({
      network: "mainnet",
      available: false,
      packageId: null,
    });
  });

  it("refuses a mainnet request with a typed error while mainnet is unavailable", async () => {
    const res = await app.request(`/api/funds?owner=${OWNER}`, {
      headers: { [NETWORK_HEADER]: "mainnet" },
    });
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("network.unavailable");
  });

  it("GET /api/funds returns the Detect funds split in the contract shape", async () => {
    const res = await app.request(`/api/funds?owner=${OWNER}&remoras=${REMORA}`, {
      headers: { [NETWORK_HEADER]: "testnet" },
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.network).toBe("testnet");
    const parsed = DetectFundsResult.parse({ splits: body.splits, movable: body.movable });
    expect(parsed.splits[0]).toMatchObject({
      role: "owner",
      addressBalance: "1000",
      coins: { total: "500", count: 1 },
    });
    expect(parsed.splits[1]).toMatchObject({ role: "remora", coins: { total: "0", count: 0 } });
    expect(parsed.movable).toBe("500");
  });

  it("rejects malformed addresses", async () => {
    const res = await app.request("/api/funds?owner=alice");
    expect((await json(res)).error.code).toBe("funds.bad_address");
  });

  it("builds an unsigned move-to-address-balance tx from the owner's coins", async () => {
    const res = await app.request("/api/funds/move", {
      method: "POST",
      body: JSON.stringify({ owner: OWNER }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(200);
    const tx = JSON.parse((await json(res)).transaction);
    expect(tx.sender).toBe(OWNER);
    const call = tx.commands.find((c: { MoveCall?: unknown }) => c.MoveCall)?.MoveCall;
    expect(`${call.module}::${call.function}`).toBe("coin::send_funds");
  });

  it("builds an unsigned withdraw-to-coin tx", async () => {
    const res = await app.request("/api/funds/withdraw", {
      method: "POST",
      body: JSON.stringify({ owner: OWNER, amount: "250" }),
      headers: { "content-type": "application/json" },
    });
    const tx = JSON.parse((await json(res)).transaction);
    expect(tx.inputs.some((i: { FundsWithdrawal?: unknown }) => i.FundsWithdrawal)).toBe(true);
    const bad = await app.request("/api/funds/withdraw", {
      method: "POST",
      body: JSON.stringify({ owner: OWNER }),
      headers: { "content-type": "application/json" },
    });
    expect((await json(bad)).error.code).toBe("funds.bad_request");
  });
});
