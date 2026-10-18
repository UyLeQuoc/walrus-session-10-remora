// U1 step 3/4: the allowance flow through Tatum gRPC, one step per run.
//   bun --env-file=.env spikes/allowance/flow.ts <network> <step> [--execute]
// Steps: status | deposit | publish | issue | pay | negatives | windows | revoke
// Testnet executes by default. Mainnet only simulates unless --execute is passed, and every
// mainnet execution needs Uy's OK first (U1 goal). `localnet` (`sui start --with-faucet`) is a dry run
// of the whole flow against a local node instead of Tatum; it adds a `faucet` step.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ChannelCredentials } from "@grpc/grpc-js";
import { bcs } from "@mysten/sui/bcs";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import {
  createTatumSuiClient,
  readFunds,
  type SuiNetwork,
  tatumSuiOptionsFromEnv,
} from "@remora/chain";

const here = dirname(fileURLToPath(import.meta.url));
const [network, step] = process.argv.slice(2) as [SuiNetwork | "localnet", string];
const execute = network !== "mainnet" || process.argv.includes("--execute");
if (!["testnet", "mainnet", "localnet"].includes(network) || !step) {
  console.error("usage: flow.ts <testnet|mainnet|localnet> <step> [--execute]");
  process.exit(1);
}

// Testnet and localnet use SUI; mainnet uses USDC with tiny amounts (≤ 0.10 USDC per transaction).
const SUI_PLAN = {
  coinType: "0x2::sui::SUI",
  deposit: 50_000_000n,
  lifetimeCap: 3_000_000n,
  perPayment: 1_000_000n,
  pay: 1_000_000n,
};
const PLAN = {
  localnet: SUI_PLAN,
  testnet: SUI_PLAN,
  mainnet: {
    coinType: process.env.USDC_COIN_TYPE ?? "",
    deposit: 100_000n,
    lifetimeCap: 50_000n,
    perPayment: 20_000n,
    pay: 10_000n,
  },
}[network];

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
// Pay the spender's own address so the spike can verify the move without a third key.
const PAYEE = SPENDER;
const STRANGER = `0x${"de".repeat(32)}`;

type State = {
  packageId?: string;
  registryId?: string;
  allowanceId?: string;
  capId?: string;
  name?: string;
  expiryMs?: number;
};
const statePath = join(here, `.state.${network}.json`);
const state: State = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
function need(id: string | undefined): string {
  if (!id) throw new Error("missing spike state: run publish, then issue");
  return id;
}
const save = () => writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

const client =
  network === "localnet"
    ? new SuiGrpcClient({
        network,
        transport: new GrpcTransport({
          host: "127.0.0.1:9000",
          channelCredentials: ChannelCredentials.createInsecure(),
        }),
      })
    : createTatumSuiClient(tatumSuiOptionsFromEnv(network));
const include = { effects: true, objectTypes: true, balanceChanges: true } as const;

/** Simulates through Tatum, then executes if allowed. Sponsored when `gasOwner` differs from the sender. */
async function run(label: string, tx: Transaction, signer: Ed25519Keypair, gasOwner = signer) {
  tx.setSenderIfNotSet(signer.toSuiAddress());
  if (gasOwner !== signer) tx.setGasOwner(gasOwner.toSuiAddress());
  const bytes = await tx.build({ client });

  const t0 = performance.now();
  const sim = await client.core.simulateTransaction({ transaction: bytes, include });
  const simMs = Math.round(performance.now() - t0);
  const simTx = sim.Transaction ?? sim.FailedTransaction;
  const status = simTx.effects?.status;
  console.log(`[${label}] simulate ${simMs}ms:`, status?.success ? "ok" : describe(status?.error));
  if (!status?.success || !execute) return { ok: false as const, status, simMs };

  const signatures = [(await signer.signTransaction(bytes)).signature];
  if (gasOwner !== signer) signatures.push((await gasOwner.signTransaction(bytes)).signature);
  const t1 = performance.now();
  const res = await client.core.executeTransaction({ transaction: bytes, signatures, include });
  const execMs = Math.round(performance.now() - t1);
  const done = res.Transaction ?? res.FailedTransaction;
  console.log(
    `[${label}] execute ${execMs}ms: ${done.digest}`,
    done.effects?.status.success ? "ok" : describe(done.effects?.status.error),
  );
  await client.core.waitForTransaction({ digest: done.digest });
  return { ok: Boolean(done.effects?.status.success), tx: done, status, simMs, execMs };
}

function describe(error: unknown): string {
  const e = error as {
    message?: string;
    MoveAbort?: {
      abortCode: string;
      location?: { module?: string };
      cleverError?: { constantName?: string };
    };
  };
  if (e?.MoveAbort) {
    const a = e.MoveAbort;
    return `MoveAbort ${a.location?.module ?? "?"}::${a.cleverError?.constantName ?? a.abortCode}`;
  }
  return e?.message ?? JSON.stringify(error);
}

function created(
  tx: {
    effects?: { changedObjects: { objectId: string; idOperation: string }[] } | null;
    objectTypes?: Record<string, string>;
  },
  typeSuffix: string,
): string | undefined {
  return tx.effects?.changedObjects.find(
    (o) => o.idOperation === "Created" && tx.objectTypes?.[o.objectId]?.includes(typeSuffix),
  )?.objectId;
}

async function funds(label: string, address: string) {
  const f = await readFunds(client, address, PLAN.coinType);
  console.log(label, address, {
    total: f.total,
    addressBalance: f.addressBalance,
    coinBalance: f.coinBalance,
  });
  return f;
}

const someU256 = (v: bigint) => bcs.option(bcs.u256()).serialize(v);
const someU64 = (v: bigint | number) => bcs.option(bcs.u64()).serialize(BigInt(v));

function allowanceWithdrawal(tx: Transaction, amount: bigint, allowanceId: string) {
  return tx.withdrawal({
    from: "allowance",
    allowance: allowanceId,
    funder: OWNER,
    amount,
    type: PLAN.coinType,
  });
}

function payTx(amount: bigint, payee: string, allowanceId = need(state.allowanceId)): Transaction {
  const tx = new Transaction();
  const w = allowanceWithdrawal(tx, amount, allowanceId);
  tx.moveCall({
    target: `${state.packageId}::disc::pay`,
    typeArguments: [PLAN.coinType],
    arguments: [
      tx.object(need(state.registryId)),
      tx.object(allowanceId),
      w,
      tx.pure.address(payee),
      tx.object.clock(),
    ],
  });
  return tx;
}

/** Builds (which simulates) and simulates again; a negative case must fail at one of the two. */
async function expectFailure(label: string, tx: Transaction, signer: Ed25519Keypair) {
  tx.setSender(signer.toSuiAddress());
  tx.setGasOwner(sponsor.toSuiAddress());
  try {
    const bytes = await tx.build({ client });
    const sim = await client.core.simulateTransaction({ transaction: bytes, include });
    const s = (sim.Transaction ?? sim.FailedTransaction).effects?.status;
    console.log(`[${label}]`, s?.success ? "UNEXPECTED SUCCESS" : describe(s?.error));
  } catch (err) {
    console.log(`[${label}] rejected before execution:`, (err as Error).message.slice(0, 300));
  }
}

function issueTx(name: string, startMs: number, expiryMs: number): Transaction {
  const tx = new Transaction();
  const rateLimitNone = tx.moveCall({
    target: "0x1::option::none",
    typeArguments: ["0x2::allowance::RateLimit"],
  });
  const proposal = tx.moveCall({
    target: "0x2::allowance::propose_for_app",
    typeArguments: [`0x2::balance::Balance<${PLAN.coinType}>`, `${state.packageId}::disc::DISC`],
    arguments: [
      tx.pure.string(name),
      tx.pure.address(SPENDER),
      tx.pure(someU256(PLAN.lifetimeCap)),
      tx.pure(someU64(startMs)),
      tx.pure(someU64(expiryMs)),
      rateLimitNone,
    ],
  });
  tx.moveCall({
    target: `${state.packageId}::disc::issue`,
    typeArguments: [PLAN.coinType],
    arguments: [
      tx.object(need(state.registryId)),
      proposal,
      tx.pure.vector("address", [PAYEE]),
      tx.pure.u64(PLAN.perPayment),
    ],
  });
  return tx;
}

console.log(
  `${network} ${step} (execute=${execute}) owner=${OWNER} spender=${SPENDER} sponsor=${sponsor.toSuiAddress()}`,
);

switch (step) {
  case "faucet": {
    if (network !== "localnet")
      throw new Error("faucet is localnet only; use faucet.sui.io for testnet");
    const res = await fetch("http://127.0.0.1:9123/v2/gas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ FixedAmountRequest: { recipient: OWNER } }),
    });
    console.log("faucet", res.status, (await res.text()).slice(0, 200));
    break;
  }
  case "status": {
    await funds("owner  ", OWNER);
    await funds("spender", SPENDER);
    console.log(state);
    break;
  }
  case "deposit": {
    // Coin → address balance with coin::send_funds, then time how long until it's readable.
    const before = await funds("before", OWNER);
    const tx = new Transaction();
    const coin =
      PLAN.coinType === "0x2::sui::SUI"
        ? tx.splitCoins(tx.gas, [PLAN.deposit])
        : tx.coin({ type: PLAN.coinType, balance: PLAN.deposit, useGasCoin: false });
    tx.moveCall({
      target: "0x2::coin::send_funds",
      typeArguments: [PLAN.coinType],
      arguments: [coin, tx.pure.address(OWNER)],
    });
    const t0 = Date.now();
    const r = await run("deposit", tx, owner);
    if (!r.ok) break;
    for (let i = 0; i < 60; i++) {
      const f = await readFunds(client, OWNER, PLAN.coinType);
      if (f.addressBalance >= before.addressBalance + PLAN.deposit) {
        console.log(
          `settled: address balance visible ${Date.now() - t0}ms after submit (poll ${i})`,
        );
        break;
      }
      await new Promise((res) => setTimeout(res, 500));
    }
    await funds("after ", OWNER);
    break;
  }
  case "publish": {
    // SPIKE_MOVE_DIR lets the run use the stub from the open Move PR before it merges.
    const pkgDir = process.env.SPIKE_MOVE_DIR ?? join(here, "../../packages/move/remora");
    const out = execFileSync(
      "sui",
      [
        "move",
        "build",
        "--dump-bytecode-as-base64",
        "-e",
        network === "mainnet" ? "mainnet" : "testnet",
      ],
      {
        cwd: pkgDir,
        encoding: "utf8",
      },
    );
    const { modules, dependencies } = JSON.parse(out.slice(out.indexOf("{")));
    const tx = new Transaction();
    const upgradeCap = tx.publish({ modules, dependencies });
    tx.transferObjects([upgradeCap], OWNER);
    const r = await run("publish", tx, owner);
    if (!r.ok || !r.tx) break;
    state.packageId = r.tx.effects?.changedObjects.find(
      (o) => o.outputState === "PackageWrite",
    )?.objectId;
    state.registryId = created(r.tx, "::disc::Registry");
    save();
    console.log(state);
    break;
  }
  case "issue": {
    const name = `spike-${Date.now()}`;
    const expiryMs = Date.now() + 7 * 24 * 3600_000;
    const r = await run("issue", issueTx(name, 0, expiryMs), owner);
    if (!r.ok || !r.tx) break;
    state.allowanceId = created(r.tx, "::allowance::Allowance<");
    state.capId = created(r.tx, "::allowance::AllowanceCap<");
    state.name = name;
    state.expiryMs = expiryMs;
    save();
    console.log(state);
    break;
  }
  case "pay": {
    // Spender signs, sponsor pays gas, funds come from the owner's address balance.
    await funds("owner before  ", OWNER);
    await funds("payee before  ", PAYEE);
    await run("pay", payTx(PLAN.pay, PAYEE), spender, sponsor);
    await funds("owner after   ", OWNER);
    await funds("payee after   ", PAYEE);
    break;
  }
  case "negatives": {
    // Simulate only: each must abort with a known code.
    await expectFailure("over per-payment cap", payTx(PLAN.perPayment + 1n, PAYEE), spender);
    await expectFailure("payee not allowlisted", payTx(1n, STRANGER), spender);
    await expectFailure("over lifetime cap", payTx(PLAN.lifetimeCap + 1n, PAYEE), spender);
    await expectFailure("not the spender", payTx(1n, PAYEE), owner);
    break;
  }
  case "windows": {
    // Two more allowances: one that starts in an hour, one that expires 15 s after issue.
    const issued: string[] = [];
    for (const [suffix, start, expiry] of [
      ["future", Date.now() + 3600_000, Date.now() + 7 * 24 * 3600_000],
      ["short", 0, Date.now() + 15_000],
    ] as const) {
      const r = await run(
        `issue ${suffix}`,
        issueTx(`spike-${suffix}-${Date.now()}`, start, expiry),
        owner,
      );
      const id = r.tx && created(r.tx, "::allowance::Allowance<");
      if (!id) throw new Error(`issue ${suffix} failed`);
      issued.push(id);
    }
    const [future, short] = issued as [string, string];
    await expectFailure("before start", payTx(1n, PAYEE, future), spender);
    await new Promise((res) => setTimeout(res, 20_000));
    await expectFailure("after expiry", payTx(1n, PAYEE, short), spender);
    break;
  }
  case "revoke": {
    if (!state.capId || !state.allowanceId) throw new Error("run issue first");
    const tx = new Transaction();
    tx.moveCall({
      target: `${state.packageId}::disc::revoke`,
      typeArguments: [PLAN.coinType],
      arguments: [
        tx.object(need(state.registryId)),
        tx.object(state.capId),
        tx.object(state.allowanceId),
      ],
    });
    const r = await run("revoke", tx, owner);
    if (!r.ok) break;
    // A spend against the deleted allowance must now fail.
    await expectFailure("pay after revoke", payTx(1n, PAYEE, state.allowanceId), spender);
    state.allowanceId = undefined;
    state.capId = undefined;
    save();
    break;
  }
  default:
    console.error(`unknown step ${step}`);
    process.exit(1);
}
process.exit(0);
