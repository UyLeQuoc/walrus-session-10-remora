/**
 * U17 D2 (ADR-0111): the payment rails under load, on Sui testnet, with the model out of the loop.
 *
 *   LOAD=1 bun --env-file=../../.env scripts/load-run.ts [remoras=50] [calls=1000]
 *
 * - **The remoras:** the testnet E2E burner makes them in teams of 10, one signature per team
 *   (`createTeam`), then confirms and activates them. Each is an ordinary Researcher with its own
 *   key and Disc: 0.30 USDC a month, 0.01 a payment, the house services as payees.
 * - **What it drives:** the product's own pay path (`requestPayment`: the ADR-0109 guard, Sonar's
 *   deterministic policy, the Disc, the gas station, the facilitator, the merchants, receipts). It
 *   runs it with no model: no answer model and no Sonar check model.
 * - **The paid calls:** concurrency 1 → 5 → 10 → 20, in that order.
 * - **The attempts that must fail:** half pay a service that asks to be paid elsewhere, half pay more
 *   than the per-payment cap. Both run with the safety check off, so the Disc itself has to stop
 *   them onchain (at the gas station's simulation). Nothing may move.
 * - **The proof:** every Disc's spend is read back over gRPC. An overspend is a Disc that spent more
 *   than its monthly limit, or a payment above its cap. The count must be 0.
 *
 * It starts its own facilitator (8898) and merchants (8899, with `DEMO_ATTACK=1` for the off-list
 * service), so the e2e ports stay free. The result goes to
 * `docs/spikes/<date>-u17-load.json`. The remoras are retired at the end, one signature per team.
 * Keys stay in this process and are never printed.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { createLogger } from "@remora/chain";
import { createDb } from "@remora/db";
import { getAllowance } from "@remora/disc-sdk";
import { DEPLOYMENTS } from "@remora/schema";
import { parseKek, RemoraSigner } from "@remora/signer";
import { createNetworks } from "../src/money/networks.ts";
import { reefFor } from "../src/money/reef.ts";
import type { Brain } from "../src/runtime/brain.ts";
import type { RuntimeDeps } from "../src/runtime/deps.ts";
import { PgKeyStore } from "../src/runtime/keys.ts";
import { SlidingLimiter } from "../src/runtime/limits.ts";
import { createRemoraService, type Remora } from "../src/runtime/remoras.ts";
import { type PayOutcome, requestPayment } from "../src/tools/pay.ts";

if (process.env.LOAD !== "1") throw new Error("Set LOAD=1: this spends testnet USDC and gas.");
const COUNT = Number(process.argv[2] ?? 50);
const CALLS = Number(process.argv[3] ?? 1_000);
const MUST_FAIL = Number(process.env.LOAD_MUST_FAIL ?? Math.max(50, Math.round(CALLS / 20)));
const ROOT = resolve(import.meta.dirname, "../../..");
const FAC = "http://localhost:8898";
const SHOP = "http://localhost:8899";
const log = createLogger({ service: "load" }, () => {});
const say = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

const env = process.env;
const burner = Ed25519Keypair.fromSecretKey(
  decodeSuiPrivateKey(env.E2E_BURNER_KEY ?? "").secretKey,
);
const owner = burner.toSuiAddress();
const payTo = Ed25519Keypair.fromSecretKey(
  decodeSuiPrivateKey(env.SPIKE_SPENDER_KEY ?? "").secretKey,
).toSuiAddress();
const sponsor = Ed25519Keypair.fromSecretKey(
  decodeSuiPrivateKey(env.SPONSOR_PRIVATE_KEY_TESTNET ?? "").secretKey,
).toSuiAddress();

// ── Its own facilitator and merchants ────────────────────────────────────────
const kids: ChildProcess[] = [];
const start = (cwd: string, extra: Record<string, string>) => {
  const p = spawn("npx", ["tsx", "src/main.ts"], {
    cwd: resolve(ROOT, cwd),
    env: { ...env, ...extra },
    stdio: "ignore",
  });
  kids.push(p);
};
const stop = () => {
  for (const k of kids) k.kill("SIGTERM");
};
process.on("exit", stop);
start("apps/facilitator", { FACILITATOR_PORT: "8898" });
start("apps/merchants", {
  MERCHANTS_PORT: "8899",
  FACILITATOR_URL_TESTNET: FAC,
  MERCHANT_PAYTO_TESTNET: payTo,
  DEMO_ATTACK: "1",
});
const up = async (url: string, want: number) => {
  for (let i = 0; i < 120; i++) {
    const s = await fetch(url).then(
      (r) => r.status,
      () => 0,
    );
    if (s === want) return;
    await new Promise((ok) => setTimeout(ok, 1_000));
  }
  throw new Error(`${url} didn't come up`);
};
await up(`${FAC}/health`, 200);
await up(`${SHOP}/odds`, 402);
say("facilitator and merchants up");

// ── The product's pieces, wired like the server, with no model ───────────────
const db = createDb(env.DATABASE_URL ?? "");
const merchants = {
  MERCHANTS_URL_TESTNET: SHOP,
  MERCHANT_PAYTO_TESTNET: payTo,
  DEMO_ATTACK: "1",
};
const networks = createNetworks({
  TATUM_API_KEY_TESTNET: env.TATUM_API_KEY_TESTNET,
  ...(env.TATUM_SUI_GRPC_TESTNET ? { TATUM_SUI_GRPC_TESTNET: env.TATUM_SUI_GRPC_TESTNET } : {}),
  FACILITATOR_URL_TESTNET: FAC,
});
const client = networks.client("testnet");
const reef = (n: "testnet" | "mainnet") => reefFor(merchants, n);
const signer = new RemoraSigner(new PgKeyStore(db), parseKek(env.KEY_ENCRYPTION_KEY ?? ""));
const service = createRemoraService({ db, networks, signer, reef, log });
const noModel = { answerModel: "none" } as unknown as Brain;
const deps = (o: Partial<RuntimeDeps> = {}): RuntimeDeps => ({
  db,
  networks,
  signer,
  log,
  reef,
  memory: { recall: async () => [], remember: async () => ({ saved: true, note: "" }) },
  brain: noModel,
  notifier: { send: async () => "sent" },
  limiter: new SlidingLimiter(),
  dailyTokens: 0,
  webBase: "http://localhost",
  ...o,
});
const rails = deps();
const usdc = DEPLOYMENTS.testnet.usdcCoinType;
const sponsorBefore = BigInt((await client.core.getBalance({ owner: sponsor })).balance.balance);
const ownerBefore = BigInt(
  (await client.core.getBalance({ owner, coinType: usdc })).balance.addressBalance,
);

// ── 1. The remoras, ten per signature ─────────────────────────────────────────
const signAndRun = async (json: string) => {
  const tx = Transaction.from(json);
  const r = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: burner,
    include: { effects: true },
  });
  const done = r.Transaction ?? r.FailedTransaction;
  if (!done?.effects?.status.success) throw new Error(`transaction failed: ${done?.digest}`);
  await client.core.waitForTransaction({ digest: done.digest });
  return done.digest;
};
const budget = {
  coinType: usdc,
  windowLimit: "300000",
  window: "month" as const,
  perPaymentCap: "10000",
  payees: ["reef:sui-risk", "reef:price", "reef:weather", "reef:walrus", "reef:wallet"],
};
const remoras: Remora[] = [];
const teamDigests: string[] = [];
const runId = Date.now().toString(36).slice(-4);
for (let t = 0; t * 10 < COUNT; t++) {
  const size = Math.min(10, COUNT - t * 10);
  const { remoras: made, transaction } = await service.createTeam(
    owner,
    "testnet",
    Array.from({ length: size }, (_, i) => ({
      template: "scout",
      name: `Load ${runId}-${t * 10 + i + 1}`,
      budget,
    })),
  );
  if (!transaction) throw new Error("no team transaction");
  const digest = await signAndRun(transaction);
  teamDigests.push(digest);
  for (const r of made) {
    await service.confirmIssue(r.id, owner, digest);
    remoras.push(await service.activate(r.id, owner));
  }
  say(`team ${t + 1}: ${made.length} remoras, ${digest}`);
}

// ── 2. The paid calls, ramping up ─────────────────────────────────────────────
const WALLET = owner;
const BLOB = "rbQ84ahd68FicrNgwK48mINczlYb6-lzncPWs9auMXw";
const MIX: { payee: string; url: string }[] = [
  { payee: "reef:price", url: `${SHOP}/price?symbols=SUI,WAL` },
  { payee: "reef:price", url: `${SHOP}/price?symbols=SUI,WAL` },
  { payee: "reef:weather", url: `${SHOP}/weather?city=Hanoi` },
  { payee: "reef:weather", url: `${SHOP}/weather?city=Hanoi` },
  { payee: "reef:walrus", url: `${SHOP}/walrus/${BLOB}` },
  { payee: "reef:wallet", url: `${SHOP}/wallet/${WALLET}` },
];
interface Call {
  step: number;
  remora: string;
  payee: string;
  kind: PayOutcome["kind"];
  code: string | null;
  amount: string;
  digest: string | null;
  ms: number;
}
const calls: Call[] = [];
let next = 0;
const one = async (
  step: number,
  o: Partial<RuntimeDeps> = {},
  pick?: { payee: string; url: string },
) => {
  const i = next++;
  const r = remoras[i % remoras.length] as Remora;
  const m = pick ?? (MIX[i % MIX.length] as { payee: string; url: string });
  const t0 = performance.now();
  const out = await requestPayment(o.sonarOff ? deps(o) : rails, r, {
    payee: m.payee,
    url: m.url,
    reason: "load run",
    trigger: { kind: "message", ref: `load:${runId}` },
    question: "load run",
    memories: [],
    onAsk: "refuse",
  }).catch(
    (err: Error): PayOutcome => ({
      kind: "blocked",
      code: err.name,
      reasons: [err.message],
      eventId: "",
    }),
  );
  calls.push({
    step,
    remora: r.id,
    payee: m.payee,
    kind: out.kind,
    code: out.kind === "blocked" ? out.code : null,
    amount: out.kind === "paid" ? out.amount : "0",
    digest: out.kind === "paid" ? out.digest : null,
    ms: Math.round(performance.now() - t0),
  });
};
const pool = async (n: number, concurrency: number, run: () => Promise<void>) => {
  let left = n;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (left-- > 0) await run();
    }),
  );
};
const share = [0.04, 0.16, 0.3, 0.5];
const STEPS = [1, 5, 10, 20].map((concurrency, k) => ({
  concurrency,
  calls: Math.round(CALLS * (share[k] ?? 0)),
}));
const steps: { concurrency: number; calls: number; startedAt: string; ms: number }[] = [];
for (const [k, s] of STEPS.entries()) {
  const t0 = Date.now();
  await pool(s.calls, s.concurrency, () => one(k));
  steps.push({ ...s, startedAt: new Date(t0).toISOString(), ms: Date.now() - t0 });
  const mine = calls.filter((c) => c.step === k);
  say(
    `step ${k + 1}: ${s.concurrency} at once, ${mine.filter((c) => c.kind === "paid").length}/${s.calls} paid in ${Math.round((Date.now() - t0) / 1000)} s`,
  );
}

// ── 3. The attempts that must fail, with the safety check off: the Disc stops them ──
const failStep = STEPS.length;
await pool(Math.ceil(MUST_FAIL / 2), 5, () =>
  one(failStep, { sonarOff: true }, { payee: "reef:market", url: `${SHOP}/market` }),
);
await pool(Math.floor(MUST_FAIL / 2), 5, () =>
  one(failStep, { sonarOff: true }, { payee: "reef:odds", url: `${SHOP}/odds?q=load` }),
);
say(
  `must-fail: ${calls.filter((c) => c.step === failStep && c.kind !== "paid").length}/${MUST_FAIL} stopped`,
);

// ── 4. Read every Disc back ──────────────────────────────────────────────────
const overspends: { remora: string; spent: string; limit: string }[] = [];
let spentOnchain = 0n;
for (const r of remoras) {
  const a = await getAllowance(client.core, r.allowanceId ?? "");
  const spent = a.rateLimit?.spent ?? 0n;
  const limit = a.rateLimit?.limit ?? 0n;
  spentOnchain += spent;
  if (spent > limit) overspends.push({ remora: r.id, spent: String(spent), limit: String(limit) });
}
const overCap = calls.filter((c) => c.kind === "paid" && BigInt(c.amount) > 10_000n);
const sponsorAfter = BigInt((await client.core.getBalance({ owner: sponsor })).balance.balance);
const ownerAfter = BigInt(
  (await client.core.getBalance({ owner, coinType: usdc })).balance.addressBalance,
);

// ── 5. The numbers ───────────────────────────────────────────────────────────
const pct = (xs: number[], p: number) =>
  xs.length
    ? ([...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] ??
      0)
    : 0;
const paid = calls.filter((c) => c.kind === "paid");
const byCode = (xs: Call[]) =>
  Object.fromEntries(
    Object.entries(
      xs.reduce<Record<string, number>>((m, c) => {
        const k = c.kind === "paid" ? "paid" : `${c.kind}:${c.code ?? ""}`;
        m[k] = (m[k] ?? 0) + 1;
        return m;
      }, {}),
    ).sort(),
  );
const result = {
  at: new Date().toISOString(),
  network: "testnet",
  label: "The payment rails under load, with the model out of the loop (no answer or check model).",
  node: env.TATUM_API_KEY_TESTNET
    ? "Tatum gRPC, with the public fullnode as fallback (ADR-0097)"
    : "public fullnode",
  remoras: remoras.length,
  teams: teamDigests,
  steps: steps.map((s, k) => {
    const mine = calls.filter((c) => c.step === k);
    const ok = mine.filter((c) => c.kind === "paid");
    return {
      concurrency: s.concurrency,
      calls: s.calls,
      paid: ok.length,
      seconds: Math.round(s.ms / 100) / 10,
      paymentsPerMinute: Math.round((ok.length / (s.ms / 60_000)) * 10) / 10,
      p50Ms: pct(
        ok.map((c) => c.ms),
        50,
      ),
      p95Ms: pct(
        ok.map((c) => c.ms),
        95,
      ),
      p99Ms: pct(
        ok.map((c) => c.ms),
        99,
      ),
      outcomes: byCode(mine),
    };
  }),
  paidCalls: paid.length,
  paidUsdc: paid.reduce((n, c) => n + BigInt(c.amount), 0n).toString(),
  allPaid: {
    p50Ms: pct(
      paid.map((c) => c.ms),
      50,
    ),
    p95Ms: pct(
      paid.map((c) => c.ms),
      95,
    ),
    p99Ms: pct(
      paid.map((c) => c.ms),
      99,
    ),
  },
  mustFail: {
    attempts: calls.filter((c) => c.step === failStep).length,
    stopped: calls.filter((c) => c.step === failStep && c.kind !== "paid").length,
    outcomes: byCode(calls.filter((c) => c.step === failStep)),
  },
  failuresByCode: byCode(calls.filter((c) => c.kind !== "paid")),
  overspends: overspends.length + overCap.length,
  overspendDetail: { discsOverLimit: overspends, paymentsOverCap: overCap.length },
  spentOnchainUsdc: spentOnchain.toString(),
  ownerUsdcSpent: (ownerBefore - ownerAfter).toString(),
  sponsorMistUsed: (sponsorBefore - sponsorAfter).toString(),
  sponsorMistPerPayment: paid.length
    ? ((sponsorBefore - sponsorAfter) / BigInt(paid.length)).toString()
    : "0",
  sampleDigests: paid.slice(0, 5).map((c) => c.digest),
};
const out = resolve(ROOT, `docs/spikes/${result.at.slice(0, 10)}-u17-load.json`);
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
say(`wrote ${out}`);
say(
  JSON.stringify({
    paid: result.paidCalls,
    overspends: result.overspends,
    steps: result.steps.map((s) => [s.concurrency, s.paymentsPerMinute, s.p95Ms]),
  }),
);

// ── 6. Retire them, ten per signature ─────────────────────────────────────────
if (env.LOAD_KEEP !== "1") {
  for (let t = 0; t * 10 < remoras.length; t++) {
    const ids = remoras.slice(t * 10, t * 10 + 10).map((r) => r.id);
    const { transaction } = await service.retireAllTx(owner, "testnet", { ids });
    const digest = await signAndRun(transaction);
    await service.confirmRetireAll(owner, "testnet", digest, { ids });
  }
  say("retired");
}
stop();
process.exit(0);
