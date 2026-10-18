import { randomBytes } from "node:crypto";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress, toBase64 } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, eq, jobs, receipts } from "@remora/db";
import { PaidBcs } from "@remora/disc-sdk";
import { loadEnv } from "@remora/memory";
import { type PaidContext, x402 } from "@remora/merchant";
import { MemoryKeyStore, RemoraSigner } from "@remora/signer";
import { Hono } from "hono";
import { afterAll, describe, expect, it } from "vitest";
import { createNetworks } from "./networks.ts";
import { payWithDisc, WAKE_ANCHOR, wakeAnchorHandler } from "./pay.ts";

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

const PKG = normalizeSuiAddress("0xcc");
const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
const MERCHANT = normalizeSuiAddress("0x3e");
const FACILITATOR = "http://facilitator.test";
const SHA = "f".repeat(64);

describe.skipIf(!local)("payWithDisc (E2, G1, G2)", () => {
  const db = createDb(local as string);
  const remoraId = `test-pay-${process.pid}`;
  const signer = new RemoraSigner(new MemoryKeyStore(), new Uint8Array(randomBytes(32)));
  let paidIntent = "";
  const digest = `D${process.pid}x`;

  afterAll(async () => {
    await db.delete(receipts).where(eq(receipts.remoraId, remoraId));
    await db.delete(jobs).where(eq(jobs.idempotencyKey, `${WAKE_ANCHOR}:testnet:${digest}`));
  });

  const client = {
    core: {
      getTransaction: async () => ({
        Transaction: {
          events: [
            {
              eventType: `${PKG}::disc::Paid`,
              bcs: PaidBcs.serialize({
                disc: normalizeSuiAddress("0xd1"),
                payee: MERCHANT,
                amount: 10_000n,
                intent: Array.from(Buffer.from(paidIntent, "hex")),
                ts_ms: 1n,
              }).toBytes(),
            },
          ],
        },
      }),
    },
  } as unknown as SuiGrpcClient;
  const networks = createNetworks(
    { TATUM_API_KEY_TESTNET: "t" },
    {
      testnet: {
        remoraPackageId: PKG,
        discRegistryId: normalizeSuiAddress("0x47"),
        usdcCoinType: USDC,
      },
      mainnet: { remoraPackageId: null, discRegistryId: null, usdcCoinType: USDC },
    },
    () => client,
  );

  const facilitator = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path === "/gas") {
      const tx = new Transaction();
      tx.setSender(await signer.address(remoraId));
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
      tx.moveCall({ target: `${PKG}::disc::pay` });
      return Response.json({ transaction: toBase64(await tx.build()) });
    }
    if (path === "/verify") return Response.json({ isValid: true });
    if (path === "/settle")
      return Response.json({ success: true, network: "sui:testnet", transaction: digest });
    return new Response(String(init?.body), { status: 404 });
  }) as typeof fetch;
  const merchant = new Hono<{ Variables: { x402: PaidContext } }>();
  merchant.get(
    "/risk",
    x402({
      amount: "10000",
      networks: { testnet: { payTo: MERCHANT, asset: USDC, facilitatorUrl: FACILITATOR } },
      disc: true,
      fetch: facilitator,
    }),
    (c) => c.json({ risk: "low" }),
  );
  const httpFetch = (async (input: string | URL | Request, init?: RequestInit) =>
    String(input).startsWith(FACILITATOR)
      ? facilitator(String(input), init)
      : merchant.request(String(input), init)) as typeof fetch;

  const draft = {
    trigger: { kind: "message" as const, ref: "tg:1" },
    inputs: { via: "tatum" as const, objects: [], sha256: SHA },
    memories: [],
    model: { id: "test", promptSha256: SHA },
    sonar: { verdict: "allow" as const, reasons: [] },
    decision: { payee: "reef:sui-risk", reason: "check the package before buying" },
  };

  it("pays, stores the Wake with its intent hash, and queues the anchor check", async () => {
    await signer.create(remoraId, "testnet");
    const { response, receipt } = await payWithDisc(
      {
        db,
        signer,
        networks,
        log: createLogger({}, () => {}),
        fetch: httpFetch,
        buildKind: async () => new Uint8Array([0]),
      },
      {
        remoraId,
        network: "testnet",
        url: "http://merchant.test/risk",
        disc: {
          discId: normalizeSuiAddress("0xd1"),
          allowanceId: normalizeSuiAddress("0xa11"),
          funder: normalizeSuiAddress("0x0f"),
        },
        maxAmount: 20_000n,
        intent: draft,
      },
    );
    expect(response.status).toBe(200);
    expect(receipt?.txDigest).toBe(digest);
    expect(receipt?.intentHash).toMatch(/^[0-9a-f]{64}$/);
    const wake = receipt?.wake as {
      intent: { decision: { payTo: string; amount: string } };
      result: { tx: string };
    };
    expect(wake.intent.decision).toMatchObject({ payTo: MERCHANT, amount: "10000" });
    expect(wake.result.tx).toBe(digest);
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.idempotencyKey, `${WAKE_ANCHOR}:testnet:${digest}`));
    expect(job?.payload).toMatchObject({ receiptId: receipt?.id, digest });

    // The anchor check matches Paid.intent against the stored hash.
    paidIntent = receipt?.intentHash ?? "";
    await wakeAnchorHandler({ db, networks, log: createLogger({}, () => {}) })(
      job?.payload,
      job as never,
    );
    const [row] = await db
      .select()
      .from(receipts)
      .where(eq(receipts.id, receipt?.id ?? ""));
    expect(row?.anchored).toBe(true);
  });

  it("fails the anchor check (so D2 retries) when Paid.intent differs", async () => {
    paidIntent = "00".repeat(32);
    const [row] = await db.select().from(receipts).where(eq(receipts.remoraId, remoraId));
    await db
      .update(receipts)
      .set({ anchored: false })
      .where(eq(receipts.id, row?.id ?? ""));
    await expect(
      wakeAnchorHandler({ db, networks, log: createLogger({}, () => {}) })(
        { receiptId: row?.id, network: "testnet", digest },
        {} as never,
      ),
    ).rejects.toThrow(/no Paid with intent/);
  });
});
