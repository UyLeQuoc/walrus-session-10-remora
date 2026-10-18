import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64, normalizeSuiAddress, toBase64 } from "@mysten/sui/utils";
import { verifyTransactionSignature } from "@mysten/sui/verify";
import {
  DiscFetchError,
  decodeHeader,
  discFetch,
  PAYMENT_RESPONSE_HEADER,
  type PaymentPayload,
  type PaymentRequired,
} from "@remora/disc-sdk";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { type PaidContext, x402 } from "./x402.ts";

const PKG = normalizeSuiAddress("0xcc");
const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
const MERCHANT = normalizeSuiAddress("0x3e");
const FACILITATOR = "http://facilitator.test";
const remora = new Ed25519Keypair();

async function sponsoredBytes() {
  const tx = new Transaction();
  tx.setSender(remora.toSuiAddress());
  tx.setGasOwner(normalizeSuiAddress("0x5905"));
  tx.setGasPayment([
    {
      objectId: normalizeSuiAddress("0x6a5"),
      version: "1",
      digest: "11111111111111111111111111111111",
    },
  ]);
  tx.setGasPrice(1_000);
  tx.setGasBudget(5_000_000);
  tx.moveCall({ target: `${PKG}::disc::pay`, arguments: [tx.pure.u64(1)] });
  return tx.build();
}

function world(o: { valid?: boolean; amount?: string } = {}) {
  const calls: { path: string; body: { paymentPayload: PaymentPayload } }[] = [];
  const facilitatorFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ path, body });
    if (path === "/verify")
      return Response.json(
        o.valid === false
          ? { isValid: false, invalidReason: "amount_mismatch" }
          : { isValid: true, payer: remora.toSuiAddress(), intent: "ab".repeat(32) },
      );
    if (path === "/settle")
      return Response.json({
        success: true,
        network: "sui:testnet",
        transaction: "D1g3st",
        payer: remora.toSuiAddress(),
      });
    if (path === "/gas") return Response.json({ transaction: toBase64(await sponsoredBytes()) });
    return new Response("?", { status: 404 });
  }) as typeof fetch;

  const app = new Hono<{ Variables: { x402: PaidContext } }>();
  app.get(
    "/report",
    x402({
      amount: o.amount ?? "10000",
      networks: { testnet: { payTo: MERCHANT, asset: USDC, facilitatorUrl: FACILITATOR } },
      disc: true,
      fetch: facilitatorFetch,
    }),
    (c) => c.json({ ok: true, paid: c.get("x402") }),
  );
  // One fetch for the client: the merchant app, or the gas station.
  const clientFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    return url.startsWith(FACILITATOR) ? facilitatorFetch(url, init) : app.request(url, init);
  }) as typeof fetch;
  return { app, calls, clientFetch };
}

describe("x402 middleware (E9)", () => {
  it("answers 402 with Disc-aware requirements and a gas station", async () => {
    const res = await world().app.request("http://merchant.test/report");
    expect(res.status).toBe(402);
    const body = (await res.json()) as PaymentRequired;
    expect(body.accepts).toEqual([
      expect.objectContaining({
        scheme: "exact",
        network: "sui:testnet",
        amount: "10000",
        asset: USDC,
        payTo: MERCHANT,
        extra: { gasStation: `${FACILITATOR}/gas`, disc: true },
      }),
    ]);
  });

  it("rejects a payment the facilitator says is invalid", async () => {
    const w = world({ valid: false });
    const header = btoa(
      JSON.stringify({
        x402Version: 1,
        scheme: "exact",
        network: "sui:testnet",
        payload: { signature: "x", transaction: "y" },
      }),
    );
    const res = await w.app.request("http://merchant.test/report", {
      headers: { "x-payment": header },
    });
    expect(res.status).toBe(402);
    expect(((await res.json()) as PaymentRequired).error).toBe("amount_mismatch");
    expect(w.calls.map((c) => c.path)).toEqual(["/verify"]);
  });
});

describe("discFetch (E2)", () => {
  const base = {
    network: "testnet" as const,
    cfg: { packageId: PKG, registryId: normalizeSuiAddress("0x47"), coinType: USDC },
    disc: {
      discId: normalizeSuiAddress("0xd1"),
      allowanceId: normalizeSuiAddress("0xa11"),
      funder: normalizeSuiAddress("0x0f"),
    },
    sender: remora.toSuiAddress(),
    sign: async (bytes: Uint8Array) => (await remora.signTransaction(bytes)).signature,
    intentFor: () => new Uint8Array(32).fill(0xab),
    buildKind: async () => new Uint8Array([0, 1, 2]),
  };

  it("pays through the gas station, signs the sponsored bytes and gets the resource", async () => {
    const w = world();
    const { response, payment } = await discFetch(
      { ...base, maxAmount: 20_000n, fetch: w.clientFetch },
      "http://merchant.test/report",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      paid: { transaction: "D1g3st", intent: "ab".repeat(32) },
    });
    expect(payment?.settle?.transaction).toBe("D1g3st");
    expect(
      decodeHeader<{ transaction: string }>(response.headers.get(PAYMENT_RESPONSE_HEADER) ?? "")
        .transaction,
    ).toBe("D1g3st");
    // The facilitator saw the remora's signature over exactly the sponsored bytes.
    const sent = w.calls.find((c) => c.path === "/verify")?.body.paymentPayload;
    const pk = await verifyTransactionSignature(
      fromBase64(sent?.payload.transaction ?? ""),
      sent?.payload.signature ?? "",
    );
    expect(pk.toSuiAddress()).toBe(remora.toSuiAddress());
    expect(w.calls.map((c) => c.path)).toEqual(["/gas", "/verify", "/settle"]);
  });

  it("refuses over the soft budget before building anything", async () => {
    const w = world({ amount: "30000" });
    await expect(
      discFetch(
        { ...base, maxAmount: 20_000n, fetch: w.clientFetch },
        "http://merchant.test/report",
      ),
    ).rejects.toMatchObject({
      code: "x402.over_soft_budget",
    });
    expect(w.calls).toEqual([]);
  });

  it("refuses when no requirement matches its network", async () => {
    const w = world();
    const err = await discFetch(
      { ...base, network: "mainnet", maxAmount: 20_000n, fetch: w.clientFetch },
      "http://merchant.test/report",
    ).catch((e) => e);
    expect(err).toBeInstanceOf(DiscFetchError);
    expect(err.code).toBe("x402.no_matching_requirements");
  });
});
