/**
 * U18 B5's exit (ADR-0120): one MPP-paid call to a paid door on Sui testnet, paid by the E2E burner,
 * with no x402 header at all. It spends the door's price in testnet USDC (it refuses above 0.05) and,
 * with `digest`, the burner's own gas.
 *
 *   MPP_EXIT=1 bun --env-file=../../.env scripts/mpp-exit.ts <door url> [transaction|digest]
 *
 * `GAS_STATION` overrides the challenge's gas station: in production the API's own doors advertise
 * the facilitator's in-container address, so pass `https://getremora.vercel.app/api/facilitator/gas`.
 *
 * - **transaction** (the default): the payload `disc.fetch` sends, without a Disc. The burner builds
 *   a USDC transfer to the challenge's payee, the challenge's gas station sponsors it, the burner
 *   signs it, and the door's facilitator settles it.
 * - **digest:** the payload @suimpp/mpp sends. The burner executes the transfer itself, signs the
 *   payment proof for the challenge, and sends the digest.
 *
 * It prints the challenge, the answer's status, the receipt and the start of the answer. Keys stay in
 * this process and are never printed.
 */
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import { createTatumSuiClient, tatumSuiOptionsFromEnv } from "@remora/chain";
import {
  decodeMpp,
  encodeMpp,
  fromWholeUnits,
  MPP_CHALLENGE_HEADER,
  MPP_CREDENTIAL_HEADER,
  MPP_RECEIPT_HEADER,
  type MppPayload,
  type MppReceipt,
  type MppRequest,
  parseChallenges,
  USDC_DECIMALS,
} from "@remora/disc-sdk";
import { suiPaymentProof } from "@remora/merchant";

if (process.env.MPP_EXIT !== "1") throw new Error("Set MPP_EXIT=1: this spends testnet USDC.");
const [url, mode = "transaction"] = process.argv.slice(2);
if (!url || (mode !== "transaction" && mode !== "digest"))
  throw new Error("Usage: scripts/mpp-exit.ts <door url> [transaction|digest]");
const burner = Ed25519Keypair.fromSecretKey(
  decodeSuiPrivateKey(process.env.E2E_BURNER_KEY ?? "").secretKey,
);
const sender = burner.toSuiAddress();
const client = createTatumSuiClient(tatumSuiOptionsFromEnv("testnet"));

const first = await fetch(url);
const challenge = parseChallenges(first.headers.get(MPP_CHALLENGE_HEADER)).find(
  (c) =>
    c.method === "sui" &&
    c.intent === "charge" &&
    decodeMpp<MppRequest>(c.request).methodDetails?.network === "testnet",
);
console.log("402:", first.status, "cache-control:", first.headers.get("cache-control"));
if (first.status !== 402 || !challenge) throw new Error("No testnet sui charge challenge.");
const request = decodeMpp<MppRequest>(challenge.request);
const amount = fromWholeUnits(request.amount, USDC_DECIMALS);
if (!amount || amount > 50_000n) throw new Error(`Refusing to pay ${request.amount} USDC.`);
console.log("challenge:", { realm: challenge.realm, expires: challenge.expires, ...request });

const tx = new Transaction();
tx.setSender(sender);
tx.transferObjects(
  [coinWithBalance({ type: request.currency, balance: amount })],
  request.recipient,
);

let payload: MppPayload;
if (mode === "digest") {
  const r = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: burner,
    include: { effects: true },
  });
  const done = r.Transaction ?? r.FailedTransaction;
  if (!done.effects?.status.success) throw new Error(`The payment failed: ${done.digest}`);
  await client.core.waitForTransaction({ digest: done.digest });
  const { signature } = await burner.signPersonalMessage(
    suiPaymentProof(challenge, request, done.digest),
  );
  payload = { digest: done.digest, signature };
} else {
  const gasStation = process.env.GAS_STATION || request.methodDetails?.gasStation;
  if (!gasStation) throw new Error("The challenge offers no gas station.");
  const kind = await tx.build({ client, onlyTransactionKind: true });
  const gas = await fetch(gasStation, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ network: "sui:testnet", sender, transactionKind: toBase64(kind) }),
  });
  const sponsored = (await gas.json()) as {
    transaction?: string;
    error?: { code: string; message: string };
  };
  if (!sponsored.transaction)
    throw new Error(`The gas station refused: ${sponsored.error?.code ?? gas.status}`);
  const { signature } = await burner.signTransaction(fromBase64(sponsored.transaction));
  payload = { type: "transaction", transaction: sponsored.transaction, signature };
}

const credential = { challenge, source: `did:pkh:sui:testnet:${sender}`, payload };
const paid = await fetch(url, {
  headers: { [MPP_CREDENTIAL_HEADER]: `Payment ${encodeMpp(credential)}` },
});
const header = paid.headers.get(MPP_RECEIPT_HEADER);
console.log("answer:", paid.status, "cache-control:", paid.headers.get("cache-control"));
console.log("receipt:", header ? decodeMpp<MppReceipt>(header) : null);
console.log((await paid.text()).slice(0, 400));
if (!paid.ok || !header) process.exitCode = 1;
