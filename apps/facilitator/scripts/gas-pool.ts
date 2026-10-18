/**
 * D8 ops: splits the testnet sponsor's SUI into a pool of gas coins, so the gas station can sponsor
 * several payments at once (one coin each, see src/gas-pool.ts).
 *
 *   bun --env-file=../../.env scripts/gas-pool.ts [count=6] [mistEach=60000000]
 *
 * Testnet only: the mainnet sponsor is set up in the mainnet pass (ADR-0024).
 */
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { createTatumSuiClient, tatumSuiOptionsFromEnv } from "@remora/chain";
import { loadEnv } from "@remora/memory";

loadEnv();
const count = Number(process.argv[2] ?? 6);
const each = BigInt(process.argv[3] ?? 60_000_000);
const raw = process.env.SPONSOR_PRIVATE_KEY_TESTNET;
if (!raw) throw new Error("SPONSOR_PRIVATE_KEY_TESTNET is not set");
const kp = Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(raw).secretKey);
const client = createTatumSuiClient(tatumSuiOptionsFromEnv("testnet"));
const owner = kp.toSuiAddress();
const coins = (await client.core.listCoins({ owner, coinType: "0x2::sui::SUI" })).objects;
const big = coins.filter((c) => BigInt(c.balance) >= each).length;
if (big >= count) {
  console.log(`sponsor ${owner} already has ${big} coins of at least ${each} MIST`);
  process.exit(0);
}
const tx = new Transaction();
const parts = tx.splitCoins(
  tx.gas,
  Array.from({ length: count - big }, () => each),
);
tx.transferObjects(
  Array.from({ length: count - big }, (_, i) => parts[i] as never),
  owner,
);
const r = await client.signAndExecuteTransaction({
  transaction: tx,
  signer: kp,
  include: { effects: true },
});
const done = r.Transaction ?? r.FailedTransaction;
if (!done.effects?.status.success) throw new Error(`split failed: ${done.digest}`);
await client.core.waitForTransaction({ digest: done.digest });
const after = (await client.core.listCoins({ owner, coinType: "0x2::sui::SUI" })).objects;
console.log(
  `split ${count - big} coins: ${done.digest}; sponsor now has ${after.length} gas coins`,
);
process.exit(0);
