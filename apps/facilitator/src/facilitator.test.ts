import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress, toBase64 } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { PaidBcs, type PaymentPayload, type PaymentRequirements } from "@remora/disc-sdk";
import { Sponsor } from "@remora/signer";
import { describe, expect, it } from "vitest";
import { createFacilitatorApp } from "./app.ts";
import { createFacilitator, type NetworkDeps } from "./facilitator.ts";
import { MemorySponsorLedger } from "./ledger.ts";

const PKG = normalizeSuiAddress("0xcc");
const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
const remora = new Ed25519Keypair();
const sponsorKp = new Ed25519Keypair();
const REMORA = remora.toSuiAddress();
const MERCHANT = normalizeSuiAddress("0x3e");
const INTENT = new Uint8Array(32).fill(9);
const GAS_COIN = {
  objectId: normalizeSuiAddress("0x6a5"),
  version: "1",
  digest: "11111111111111111111111111111111",
};

const sponsor = new Sponsor(sponsorKp.getSecretKey(), {
  allowedPackages: [PKG, "0x1", "0x2"],
  maxGasBudget: 50_000_000n,
});

async function signedPay(
  opts: { sponsored?: boolean; budget?: number; signer?: Ed25519Keypair } = {},
) {
  const tx = new Transaction();
  tx.setSender(REMORA);
  tx.setGasOwner(opts.sponsored === false ? REMORA : sponsor.address);
  tx.setGasPayment([GAS_COIN]);
  tx.setGasPrice(1_000);
  tx.setGasBudget(opts.budget ?? 5_000_000);
  tx.moveCall({ target: `${PKG}::disc::pay`, typeArguments: [USDC], arguments: [tx.pure.u64(1)] });
  const bytes = await tx.build();
  const { signature } = await (opts.signer ?? remora).signTransaction(bytes);
  return { bytes, signature };
}

const paidEvent = (payee = MERCHANT, amount = 10_000n) => ({
  packageId: PKG,
  module: "disc",
  sender: REMORA,
  eventType: `${PKG}::disc::Paid`,
  bcs: PaidBcs.serialize({
    disc: normalizeSuiAddress("0xd1"),
    payee,
    amount,
    intent: Array.from(INTENT),
    ts_ms: 1n,
  }).toBytes(),
});

function fakeClient(
  o: { credited?: string; ok?: boolean; executed?: boolean; events?: unknown[] } = {},
) {
  const executedDigests: string[] = [];
  const result = (digest: string) => ({
    digest,
    effects: {
      status:
        o.ok === false
          ? {
              success: false,
              error: {
                message: "x",
                MoveAbort: { abortCode: "4", cleverError: { constantName: "EOverPaymentCap" } },
              },
            }
          : { success: true, error: null },
      gasUsed: {
        computationCost: "1000000",
        storageCost: "2000000",
        storageRebate: "1500000",
        nonRefundableStorageFee: "0",
      },
    },
    balanceChanges: [{ coinType: USDC, address: MERCHANT, amount: o.credited ?? "10000" }],
    events: o.events ?? [paidEvent()],
  });
  return {
    executedDigests,
    core: {
      simulateTransaction: async () => ({ Transaction: result("sim") }),
      getTransaction: async ({ digest }: { digest: string }) => {
        if (o.executed || executedDigests.includes(digest)) return { Transaction: result(digest) };
        throw Object.assign(new Error("not found"), { code: "NOT_FOUND" });
      },
      executeTransaction: async ({ signatures }: { signatures: string[] }) => {
        executedDigests.push(`exec-${signatures.length}`);
        return { Transaction: result("Dig3st") };
      },
      waitForTransaction: async () => ({}),
      getBalance: async () => ({ balance: { balance: "1" } }),
    },
  };
}

const requirements = (
  extra: PaymentRequirements["extra"] = { disc: true },
): PaymentRequirements => ({
  scheme: "exact",
  network: "sui:testnet",
  amount: "10000",
  asset: USDC,
  payTo: MERCHANT,
  maxTimeoutSeconds: 60,
  extra,
});

function setup(client = fakeClient(), dailyGasBudget = 100_000_000n) {
  const ledger = new MemorySponsorLedger();
  const network: NetworkDeps = {
    network: "testnet",
    client: client as never,
    sponsor,
    packageId: PKG,
    usdcCoinType: USDC,
  };
  const f = createFacilitator({
    networks: { testnet: network },
    ledger,
    dailyGasBudget,
    log: createLogger({}, () => {}),
  });
  return { f, ledger, client };
}

const payloadOf = (
  p: { bytes: Uint8Array; signature: string },
  network: PaymentPayload["network"] = "sui:testnet",
): PaymentPayload => ({
  x402Version: 1,
  scheme: "exact",
  network,
  payload: { signature: p.signature, transaction: toBase64(p.bytes) },
});

describe("verify (E3)", () => {
  it("accepts a signed, sponsored Disc payment and returns the Paid intent", async () => {
    const { f } = setup();
    const v = await f.verify(payloadOf(await signedPay()), requirements());
    expect(v).toEqual({
      isValid: true,
      payer: normalizeSuiAddress(REMORA),
      intent: "09".repeat(32),
    });
  });

  it("rejects a network mismatch, a bad signature and an unknown gas owner", async () => {
    const { f } = setup();
    const p = await signedPay();
    expect((await f.verify(payloadOf(p, "sui:mainnet"), requirements())).invalidReason).toBe(
      "network_mismatch",
    );
    const forged = await signedPay({ signer: new Ed25519Keypair() });
    expect((await f.verify(payloadOf(forged), requirements())).invalidReason).toBe(
      "invalid_signature",
    );
    const tx = new Transaction();
    tx.setSender(REMORA);
    tx.setGasOwner(new Ed25519Keypair().toSuiAddress());
    tx.setGasPayment([GAS_COIN]);
    tx.setGasPrice(1_000);
    tx.setGasBudget(1_000_000);
    tx.moveCall({ target: `${PKG}::disc::pay` });
    const bytes = await tx.build();
    const stranger = { bytes, signature: (await remora.signTransaction(bytes)).signature };
    expect((await f.verify(payloadOf(stranger), requirements())).invalidReason).toBe(
      "unknown_gas_owner",
    );
  });

  it("rejects the wrong amount, a failed simulation, a replay and a non-Disc payment", async () => {
    const p = await signedPay();
    expect(
      (await setup(fakeClient({ credited: "9999" })).f.verify(payloadOf(p), requirements()))
        .invalidReason,
    ).toBe("amount_mismatch");
    expect(
      (await setup(fakeClient({ ok: false })).f.verify(payloadOf(p), requirements())).invalidReason,
    ).toBe("simulation_failed:disc.over_per_payment_cap");
    expect(
      (await setup(fakeClient({ executed: true })).f.verify(payloadOf(p), requirements()))
        .invalidReason,
    ).toBe("already_executed");
    expect(
      (await setup(fakeClient({ events: [] })).f.verify(payloadOf(p), requirements()))
        .invalidReason,
    ).toBe("not_a_disc_payment");
    // Without Disc-aware mode a plain payment passes.
    expect(
      (await setup(fakeClient({ events: [] })).f.verify(payloadOf(p), requirements({}))).isValid,
    ).toBe(true);
  });
});

describe("settle + sponsor budget (E3, D8)", () => {
  it("co-signs, executes and settles the ledger", async () => {
    const { f, ledger, client } = setup();
    const s = await f.settle(payloadOf(await signedPay()), requirements());
    expect(s).toMatchObject({ success: true, transaction: "Dig3st", network: "sui:testnet" });
    expect(client.executedDigests).toEqual(["exec-2"]);
    const [row] = [...ledger.rows.values()];
    expect(row).toMatchObject({ status: "settled", gasUsed: 1_500_000n });
  });

  it("refuses to sponsor past the sender's daily gas budget", async () => {
    const { f, client } = setup(fakeClient(), 4_000_000n);
    const s = await f.settle(payloadOf(await signedPay({ budget: 5_000_000 })), requirements());
    expect(s).toMatchObject({ success: false, errorReason: "sponsor.out_of_gas" });
    expect(client.executedDigests).toEqual([]);
  });

  it("refuses a gas budget over the sponsor's cap at verify time", async () => {
    const { f } = setup();
    const v = await f.verify(payloadOf(await signedPay({ budget: 60_000_000 })), requirements());
    expect(v.invalidReason).toBe("sponsor.gas_budget_too_high");
  });

  it("doesn't double-count gas reserved by the gas station", async () => {
    const { f, ledger } = setup(fakeClient(), 6_000_000n);
    const p = await signedPay({ budget: 5_000_000 });
    // As if /gas had reserved this exact transaction.
    const { TransactionDataBuilder } = await import("@mysten/sui/transactions");
    await ledger.reserve({
      network: "testnet",
      sender: normalizeSuiAddress(REMORA),
      day: new Date().toISOString().slice(0, 10),
      digest: TransactionDataBuilder.getDigestFromBytes(p.bytes),
      gasBudget: 5_000_000n,
    });
    expect((await f.settle(payloadOf(p), requirements())).success).toBe(true);
  });
});

describe("HTTP", () => {
  it("serves /supported and /verify", async () => {
    const app = createFacilitatorApp(setup().f);
    const supported = await (await app.request("/supported")).json();
    expect(supported).toEqual({
      kinds: [
        {
          x402Version: 1,
          scheme: "exact",
          network: "sui:testnet",
          extra: { sponsored: true, discAware: true },
        },
      ],
    });
    const res = await app.request("/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paymentPayload: payloadOf(await signedPay()),
        paymentRequirements: requirements(),
      }),
    });
    expect(((await res.json()) as { isValid: boolean }).isValid).toBe(true);
  });
});
