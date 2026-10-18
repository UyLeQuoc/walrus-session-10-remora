// U2 testnet e2e of the real Disc through Tatum gRPC, built with @remora/disc-sdk.
//   bun --env-file=.env spikes/disc/e2e.ts publish   # SPIKE_MOVE_DIR may point at the Move PR's sources
//   bun --env-file=.env spikes/disc/e2e.ts run       # the whole flow; digests go to .results.testnet.json
// Testnet only (ADR-0024). Keys come from .env; nothing here may touch mainnet.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { createTatumSuiClient, tatumSuiOptionsFromEnv } from "@remora/chain";
import {
  buildIssue,
  buildPause,
  buildPay,
  buildRevoke,
  buildRevokeAndReissue,
  buildRotate,
  buildSetPayees,
  type DiscConfig,
  findDiscId,
  getAllowance,
  getDisc,
  getFundsSplit,
  type IssueArgs,
  listOwnerDiscs,
  paidEvents,
  toDiscError,
} from "@remora/disc-sdk";

const here = dirname(fileURLToPath(import.meta.url));
const step = process.argv[2];
const USDC = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

function keypair(envKey: string): Ed25519Keypair {
  const raw = process.env[envKey];
  if (!raw) throw new Error(`${envKey} is not set`);
  return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(raw).secretKey);
}
const owner = keypair("SPIKE_OWNER_KEY");
const spender = keypair("SPIKE_SPENDER_KEY");
const sponsor = keypair("SPIKE_SPONSOR_KEY");
const OWNER = owner.toSuiAddress();
const SPENDER = spender.toSuiAddress();
// A payee we can read back; a second one for set_payees; one that's never allowed.
const PAYEE = SPENDER;
const PAYEE2 = OWNER;
const STRANGER = `0x${"de".repeat(32)}`;

type State = {
  packageId?: string;
  registryId?: string;
  upgradeCapId?: string;
  publishDigest?: string;
};
const statePath = join(here, ".state.testnet.json");
const state: State = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const results: Record<string, unknown> = {};

const client = createTatumSuiClient(tatumSuiOptionsFromEnv("testnet"));
const include = { effects: true, objectTypes: true, events: true, balanceChanges: true } as const;

async function run(
  label: string,
  tx: Transaction,
  signer: Ed25519Keypair,
  gasOwner?: Ed25519Keypair,
) {
  tx.setSenderIfNotSet(signer.toSuiAddress());
  if (gasOwner) tx.setGasOwner(gasOwner.toSuiAddress());
  const bytes = await tx.build({ client });
  const signatures = [(await signer.signTransaction(bytes)).signature];
  if (gasOwner) signatures.push((await gasOwner.signTransaction(bytes)).signature);
  const res = await client.core.executeTransaction({ transaction: bytes, signatures, include });
  const done = res.Transaction ?? res.FailedTransaction;
  if (!done.effects?.status.success) {
    throw new Error(`${label} failed: ${JSON.stringify(done.effects?.status.error)}`);
  }
  await client.core.waitForTransaction({ digest: done.digest });
  console.log(`[${label}] ${done.digest}`);
  results[label] = done.digest;
  return done;
}

/** Must fail before execution (simulate or build); records the typed error. */
async function expectFailure(label: string, tx: Transaction, signer: Ed25519Keypair) {
  tx.setSenderIfNotSet(signer.toSuiAddress());
  tx.setGasOwner(sponsor.toSuiAddress());
  let failure: unknown;
  try {
    const bytes = await tx.build({ client });
    const sim = await client.core.simulateTransaction({ transaction: bytes, include });
    const s = (sim.Transaction ?? sim.FailedTransaction).effects?.status;
    if (s?.success) throw new Error(`${label}: UNEXPECTED SUCCESS`);
    failure = s?.error;
  } catch (err) {
    if ((err as Error).message?.includes("UNEXPECTED SUCCESS")) throw err;
    failure = err;
  }
  const typed = toDiscError(failure);
  console.log(`[${label}] rejected: ${typed.code}${typed.constant ? ` (${typed.constant})` : ""}`);
  results[label] = typed;
  return typed;
}

function created(
  tx: {
    effects?: { changedObjects: { objectId: string; idOperation: string }[] } | null;
    objectTypes?: Record<string, string>;
  },
  suffix: string,
): string {
  const id = tx.effects?.changedObjects.find(
    (o) =>
      o.idOperation === "Created" &&
      tx.objectTypes?.[o.objectId]?.match(new RegExp(`${suffix.replace(/<$/, "")}(<|$)`)),
  )?.objectId;
  if (!id) throw new Error(`no created ${suffix}`);
  return id;
}

const sha256 = (s: string) => new Uint8Array(createHash("sha256").update(s).digest());
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

if (step === "publish") {
  const pkgDir = process.env.SPIKE_MOVE_DIR ?? join(here, "../../packages/move/remora");
  const out = execFileSync("sui", ["move", "build", "--dump-bytecode-as-base64", "-e", "testnet"], {
    cwd: pkgDir,
    encoding: "utf8",
  });
  const { modules, dependencies } = JSON.parse(out.slice(out.indexOf("{")));
  const tx = new Transaction();
  tx.transferObjects([tx.publish({ modules, dependencies })], OWNER);
  const done = await run("publish", tx, owner);
  state.packageId = done.effects?.changedObjects.find(
    (o) => o.outputState === "PackageWrite",
  )?.objectId;
  state.registryId = created(done, "::disc::Registry");
  state.upgradeCapId = created(done, "::package::UpgradeCap");
  state.publishDigest = done.digest;
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  console.log(state);
  process.exit(0);
}

if (step !== "run") {
  console.error("usage: e2e.ts publish|run");
  process.exit(1);
}
if (!state.packageId || !state.registryId) throw new Error("run publish first");
const cfg: DiscConfig = {
  packageId: state.packageId,
  registryId: state.registryId,
  coinType: USDC,
};
const reader = client.core;

// 0. Funds: the owner's USDC address balance pays; top it up from coins if low.
const before = await getFundsSplit(reader, OWNER, USDC);
console.log("owner USDC", before);
if (before.addressBalance < 500_000n) {
  const tx = new Transaction();
  const coin = tx.coin({ type: USDC, balance: 1_000_000n, useGasCoin: false });
  tx.moveCall({
    target: "0x2::coin::send_funds",
    typeArguments: [USDC],
    arguments: [coin, tx.pure.address(OWNER)],
  });
  await run("deposit 1 USDC", tx, owner);
}

// 1. Issue a Disc.
const name = `e2e-${Date.now()}`;
const issueArgs: IssueArgs = {
  name,
  spender: SPENDER,
  lifetimeCap: 200_000n,
  expiryMs: Date.now() + 7 * 24 * 3600_000,
  payees: [PAYEE],
  perPaymentCap: 20_000n,
};
const issued = await run("issue", buildIssue(cfg, issueArgs), owner);
let discId = created(issued, "::disc::Disc");
let allowanceId = created(issued, "::allowance::Allowance<");
let capId = created(issued, "::allowance::AllowanceCap<");
const found = await findDiscId(reader, cfg, OWNER, name);
if (found !== discId) throw new Error(`registry lookup ${found} != ${discId}`);
const disc = await getDisc(reader, discId);
const alw = await getAllowance(reader, allowanceId);
console.log("disc", disc, "allowance app", alw.app, "spender", alw.spender);
results.ids = { discId, allowanceId, capId };

// 2. Pay with an intent, sponsored, and read Paid back by digest.
const intent = sha256(`remora e2e intent ${name}`);
const payArgs = { discId, allowanceId, funder: OWNER, payee: PAYEE, amount: 10_000n, intent };
const paidTx = await run(
  "pay",
  buildPay(cfg, payArgs, { sender: SPENDER, gasOwner: sponsor.toSuiAddress() }),
  spender,
  sponsor,
);
const fetched = await client.core.getTransaction({
  digest: paidTx.digest,
  include: { events: true },
});
const [paid] = paidEvents(cfg, (fetched.Transaction ?? fetched.FailedTransaction).events);
if (!paid || hex(paid.intent) !== hex(intent) || paid.amount !== 10_000n || paid.payee !== PAYEE) {
  throw new Error(
    `Paid mismatch: ${JSON.stringify(paid, (_, v) => (typeof v === "bigint" ? `${v}` : v))}`,
  );
}
results.paidIntent = hex(paid.intent);
console.log("Paid read back:", {
  amount: paid.amount,
  payee: paid.payee,
  intent: hex(paid.intent),
});

// 3. Negatives, simulate-only.
const pay = (o: Partial<typeof payArgs>, signer = spender) =>
  buildPay(
    cfg,
    { ...payArgs, ...o },
    { sender: signer.toSuiAddress(), gasOwner: sponsor.toSuiAddress() },
  );
await expectFailure("over per-payment cap", pay({ amount: 20_001n }), spender);
await expectFailure("payee not allowlisted", pay({ payee: STRANGER, amount: 1n }), spender);
await expectFailure("over lifetime cap", pay({ amount: 200_001n }), spender);
await expectFailure("not the spender", pay({ amount: 1n }, owner), owner);
const badIntent = new Transaction();
badIntent.moveCall({
  target: `${cfg.packageId}::disc::pay`,
  typeArguments: [USDC],
  arguments: [
    badIntent.object(discId),
    badIntent.object(allowanceId),
    badIntent.withdrawal({
      from: "allowance",
      allowance: allowanceId,
      funder: OWNER,
      amount: 1n,
      type: USDC,
    }),
    badIntent.pure.address(PAYEE),
    badIntent.pure.vector("u8", [1, 2, 3]),
    badIntent.object.clock(),
  ],
});
await expectFailure("intent not 32 bytes", badIntent, spender);
await expectFailure("non-owner pause", buildPause(cfg, [discId], true), spender);

// 4. Pause blocks, unpause resumes.
await run("pause", buildPause(cfg, [discId], true), owner);
await expectFailure("pay while paused", pay({ amount: 1n }), spender);
await run("unpause", buildPause(cfg, [discId], false), owner);

// 5. set_payees: the new payee works.
await run("set payees", buildSetPayees(cfg, discId, [PAYEE, PAYEE2]), owner);
await run("pay new payee", pay({ payee: PAYEE2, amount: 5_000n }), spender, sponsor);

// 6. Rotate to a fresh key: the old one is locked out, the new one pays.
const rotated = new Ed25519Keypair();
await run(
  "rotate",
  buildRotate(cfg, { discId, allowanceId, newSpender: rotated.toSuiAddress() }),
  owner,
);
await expectFailure("old key after rotate", pay({ amount: 1n }), spender);
await run("pay with rotated key", pay({ amount: 1_000n }, rotated), rotated, sponsor);

// 7. Budget change: revoke + reissue in one PTB, same name, bigger per-payment cap.
const reissue = {
  ...issueArgs,
  spender: rotated.toSuiAddress(),
  lifetimeCap: 300_000n,
  perPaymentCap: 50_000n,
};
const swapped = await run(
  "revoke + reissue",
  buildRevokeAndReissue(cfg, { discId, capId, allowanceId }, reissue),
  owner,
);
discId = created(swapped, "::disc::Disc");
allowanceId = created(swapped, "::allowance::Allowance<");
capId = created(swapped, "::allowance::AllowanceCap<");
await run(
  "pay 0.04 under new budget",
  buildPay(
    cfg,
    { ...payArgs, discId, allowanceId, amount: 40_000n },
    { sender: rotated.toSuiAddress(), gasOwner: sponsor.toSuiAddress() },
  ),
  rotated,
  sponsor,
);
const mine = await listOwnerDiscs(reader, cfg, OWNER);
console.log(
  "owner Discs:",
  mine.map((d) => ({
    name: d.disc.name,
    cap: d.disc.perPaymentCap,
    spent: d.allowance.currentSpend,
  })),
);
results.ownerDiscs = mine.length;

// 8. Revoke; paying afterwards fails.
await run("revoke", buildRevoke(cfg, { discId, capId, allowanceId }), owner);
await expectFailure(
  "pay after revoke",
  buildPay(
    cfg,
    { ...payArgs, discId, allowanceId, amount: 1n },
    { sender: rotated.toSuiAddress(), gasOwner: sponsor.toSuiAddress() },
  ),
  rotated,
);

const after = await getFundsSplit(reader, OWNER, USDC);
console.log("owner USDC after", after);
writeFileSync(
  join(here, ".results.testnet.json"),
  `${JSON.stringify({ state, results }, (_, v) => (typeof v === "bigint" ? `${v}` : v), 2)}\n`,
);
process.exit(0);
