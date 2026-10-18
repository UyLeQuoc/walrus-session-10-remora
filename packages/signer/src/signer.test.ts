import { randomBytes } from "node:crypto";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { verifyTransactionSignature } from "@mysten/sui/verify";
import { describe, expect, it } from "vitest";
import { open, parseKek, rewrap, seal } from "./envelope.ts";
import { MemoryKeyStore, RemoraSigner } from "./remora-keys.ts";
import { inspect, Sponsor, type SponsorRefusal } from "./sponsor.ts";

const kek = new Uint8Array(randomBytes(32));
const secret = new TextEncoder().encode("suiprivkey1-not-a-real-key");

describe("envelope (B4)", () => {
  it("round-trips", () => {
    expect(new TextDecoder().decode(open(seal(secret, kek, "r1"), kek, "r1"))).toBe(
      "suiprivkey1-not-a-real-key",
    );
  });

  it("rejects a tampered ciphertext, the wrong record and the wrong KEK", () => {
    const s = seal(secret, kek, "r1");
    const flipped = Buffer.from(s.data.ct, "base64");
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    expect(() =>
      open({ ...s, data: { ...s.data, ct: flipped.toString("base64") } }, kek, "r1"),
    ).toThrow();
    expect(() => open(s, kek, "r2")).toThrow();
    expect(() => open(s, new Uint8Array(randomBytes(32)), "r1")).toThrow();
  });

  it("rewraps under a new KEK without changing the secret", () => {
    const next = new Uint8Array(randomBytes(32));
    const s = rewrap(seal(secret, kek, "r1"), kek, next, "r1");
    expect(new TextDecoder().decode(open(s, next, "r1"))).toBe("suiprivkey1-not-a-real-key");
    expect(() => open(s, kek, "r1")).toThrow();
  });

  it("validates the KEK format", () => {
    expect(() => parseKek("abc")).toThrow(/64 hex/);
    expect(parseKek("a".repeat(64))).toHaveLength(32);
  });
});

describe("RemoraSigner (B4)", () => {
  it("creates one key per remora and signs verifiable transactions", async () => {
    const store = new MemoryKeyStore();
    const signer = new RemoraSigner(store, kek);
    const address = await signer.create("scout-1", "testnet");
    expect(await signer.create("scout-1", "testnet")).toBe(address);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const signature = await signer.signTransaction("scout-1", bytes);
    const pk = await verifyTransactionSignature(bytes, signature);
    expect(pk.toSuiAddress()).toBe(address);
  });

  it("stores only sealed bytes and never serializes the KEK or the key", async () => {
    const store = new MemoryKeyStore();
    const signer = new RemoraSigner(store, kek);
    await signer.create("scout-2", "testnet");
    const stored = JSON.stringify(store.keys.get("scout-2"));
    expect(stored).not.toMatch(/suiprivkey/);
    expect(JSON.stringify(signer)).toBe('{"signer":"RemoraSigner"}');
  });

  it("refuses a sealed key moved onto another remora", async () => {
    const store = new MemoryKeyStore();
    const signer = new RemoraSigner(store, kek);
    await signer.create("a", "testnet");
    const a = store.keys.get("a");
    if (!a) throw new Error("no key");
    store.keys.set("b", { ...a, remoraId: "b" });
    await expect(signer.signTransaction("b", new Uint8Array([1]))).rejects.toThrow();
  });
});

describe("sponsor policy (D8)", () => {
  const sponsorKp = new Ed25519Keypair();
  const SPONSOR = sponsorKp.toSuiAddress();
  const REMORA = new Ed25519Keypair().toSuiAddress();
  const OWNER = new Ed25519Keypair().toSuiAddress();
  const PKG = normalizeSuiAddress("0xcc");
  const policy = { allowedPackages: [PKG, "0x2"], maxGasBudget: 50_000_000n };

  const payTx = (funder = OWNER) => {
    const tx = new Transaction();
    tx.setSender(REMORA);
    tx.setGasOwner(SPONSOR);
    tx.setGasBudget(10_000_000);
    const w = tx.withdrawal({
      from: "allowance",
      allowance: normalizeSuiAddress("0xa1"),
      funder,
      amount: 10n,
      type: "0x2::sui::SUI",
    });
    tx.moveCall({
      target: `${PKG}::disc::pay`,
      typeArguments: ["0x2::sui::SUI"],
      arguments: [tx.object("0xd1"), w],
    });
    return tx;
  };
  const code = (f: () => unknown) => {
    try {
      f();
    } catch (e) {
      return (e as SponsorRefusal).code;
    }
    return "ok";
  };

  it("accepts a remora's Disc payment", () => {
    expect(inspect(payTx().getData(), SPONSOR, policy)).toEqual({
      sender: normalizeSuiAddress(REMORA),
      gasBudget: 10_000_000n,
    });
  });

  it("refuses when the sponsor funds the allowance (ADR-0020)", () => {
    expect(code(() => inspect(payTx(SPONSOR).getData(), SPONSOR, policy))).toBe(
      "sponsor.is_funder",
    );
  });

  it("refuses withdrawals from the sponsor's own balance", () => {
    const tx = payTx();
    tx.withdrawal({ from: "sponsor", amount: 1n });
    expect(code(() => inspect(tx.getData(), SPONSOR, policy))).toBe("sponsor.is_funder");
  });

  it("refuses touching the gas coin", () => {
    const tx = payTx();
    const [c] = tx.splitCoins(tx.gas, [1]);
    tx.transferObjects([c as never], REMORA);
    expect(code(() => inspect(tx.getData(), SPONSOR, policy))).toBe("sponsor.gas_coin_used");
  });

  it("refuses other packages, foreign gas owners, the sponsor as sender, and big budgets", () => {
    const other = payTx();
    other.moveCall({ target: "0xbad::evil::drain" });
    expect(code(() => inspect(other.getData(), SPONSOR, policy))).toBe(
      "sponsor.package_not_allowed",
    );
    const notMine = payTx();
    notMine.setGasOwner(OWNER);
    expect(code(() => inspect(notMine.getData(), SPONSOR, policy))).toBe("sponsor.not_gas_owner");
    const self = payTx();
    self.setSender(SPONSOR);
    expect(code(() => inspect(self.getData(), SPONSOR, policy))).toBe("sponsor.is_sender");
    const big = payTx();
    big.setGasBudget(60_000_000);
    expect(code(() => inspect(big.getData(), SPONSOR, policy))).toBe("sponsor.gas_budget_too_high");
  });

  it("Sponsor never serializes its key", () => {
    const s = new Sponsor(sponsorKp.getSecretKey(), policy);
    expect(JSON.stringify(s)).toBe(JSON.stringify({ sponsor: SPONSOR }));
  });
});
