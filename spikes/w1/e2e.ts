// U3 step 11: the W1 exit e2e on testnet, through Tatum.
//   bun --env-file=.env spikes/w1/e2e.ts
// A remora (B4 key) pays the sui-risk merchant through its Disc via discFetch: 402 → gas station (D8)
// → remora signs → facilitator verify/settle (E3) → 200. Then it checks sponsored gas, the owner's
// address balance, Paid.intent == the stored Wake hash, and the indexer row. Negatives: over cap, bad
// payee, sponsor budget out, mainnet refused. Ports 8797-8800 (8787/5173 belong to another project).
// Testnet only (ADR-0024).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, discEvents, eq, receipts } from "@remora/db";
import {
  buildIssue,
  type DiscConfig,
  type DiscFetchError,
  getFundsSplit,
  type PaymentRequired,
  paidEvents,
} from "@remora/disc-sdk";
import {
  createFacilitator,
  createFacilitatorApp,
  facilitatorDepsFromEnv,
  MemorySponsorLedger,
} from "@remora/facilitator";
import { loadEnv } from "@remora/memory";
import { type PaidContext, x402 } from "@remora/merchant";
import { createSuiRiskApp } from "@remora/merchants";
import { parseKek, RemoraSigner } from "@remora/signer";
import { Hono } from "hono";
import { createNetworks } from "../../apps/server/src/money/networks.ts";
import { payWithDisc, WAKE_ANCHOR, wakeAnchorHandler } from "../../apps/server/src/money/pay.ts";
import { createMoneyRoutes } from "../../apps/server/src/money/routes.ts";
import { runOnce } from "../../apps/server/src/runtime/jobs.ts";
import { PgKeyStore } from "../../apps/server/src/runtime/keys.ts";
import { startIndexer } from "../../apps/server/src/triggers/indexer.ts";

/** `::disc::Disc` must not match `::disc::DiscKey`: the type ends there or continues with `<`. */
const typeMatcher = (suffix: string) =>
  new RegExp(`${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/<$/, "")}(<|$)`);

loadEnv();
const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const log = createLogger({ service: "w1-e2e" }, (l) => {
  if (/"level":"(warn|error)"/.test(l)) console.log(l);
});
const results: Record<string, unknown> = {};
const kp = (k: string) => Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(env[k] ?? "").secretKey);
const owner = kp("SPIKE_OWNER_KEY");
const OWNER = owner.toSuiAddress();
const MERCHANT = kp("SPIKE_SPENDER_KEY").toSuiAddress(); // a payTo we can read back
const STRANGER = normalizeSuiAddress(`0x${"de".repeat(32)}`);
const SHA = "e".repeat(64);
const FAC = "http://localhost:8798";

if (!env.DATABASE_URL || !/localhost|127\.0\.0\.1/.test(env.DATABASE_URL))
  throw new Error("local DATABASE_URL required");
const db = createDb(env.DATABASE_URL);
const networks = createNetworks({ ...env, FACILITATOR_URL_TESTNET: FAC });
const client = networks.client("testnet");
const net = networks.config("testnet");
if (!net.packageId || !net.discRegistryId) throw new Error("testnet Disc not published");
const cfg: DiscConfig = {
  packageId: net.packageId,
  registryId: net.discRegistryId,
  coinType: net.usdcCoinType,
};

// --- Servers: money routes (8797), facilitator + gas station (8798), sui-risk (8799), a broke facilitator (8800).
const servers = [
  serve({ fetch: createMoneyRoutes({ networks, log }).fetch, port: 8797 }),
  serve({
    fetch: createFacilitatorApp(createFacilitator(facilitatorDepsFromEnv(env, log))).fetch,
    port: 8798,
  }),
];
const testnetPay = { testnet: { payTo: MERCHANT, asset: cfg.coinType, facilitatorUrl: FAC } };
const merchant = createSuiRiskApp({
  pay: { amount: "10000", description: "Sui object risk report", networks: testnetPay, disc: true },
  clients: { testnet: client },
});
// Negative-case routes on the same merchant: priced over the Disc cap, and paying a non-allowlisted address.
const extra = new Hono<{ Variables: { x402: PaidContext } }>();
extra.get("/pricey", x402({ amount: "25000", networks: testnetPay, disc: true }), (c) =>
  c.json({ ok: true }),
);
extra.get(
  "/stranger",
  x402({
    amount: "1000",
    networks: { testnet: { ...testnetPay.testnet, payTo: STRANGER } },
    disc: true,
  }),
  (c) => c.json({ ok: true }),
);
extra.route("/", merchant);
servers.push(serve({ fetch: extra.fetch, port: 8799 }));
const brokeDeps = facilitatorDepsFromEnv(env, log);
brokeDeps.ledger = new MemorySponsorLedger();
brokeDeps.dailyGasBudget = 1n;
servers.push(
  serve({ fetch: createFacilitatorApp(createFacilitator(brokeDeps)).fetch, port: 8800 }),
);
const broke = new Hono<{ Variables: { x402: PaidContext } }>();
broke.get(
  "/x",
  x402({
    amount: "1000",
    networks: { testnet: { ...testnetPay.testnet, facilitatorUrl: "http://localhost:8800" } },
    disc: true,
  }),
  (c) => c.json({ ok: true }),
);
servers.push(serve({ fetch: broke.fetch, port: 8801 }));
await new Promise((r) => setTimeout(r, 500));

try {
  // 1. A9·be: networks and the typed mainnet refusal over real HTTP.
  results.networks = await (await fetch("http://localhost:8797/api/networks")).json();
  const refused = await fetch(`http://localhost:8797/api/funds?owner=${OWNER}`, {
    headers: { "x-remora-network": "mainnet" },
  });
  results.mainnetRefusal = { status: refused.status, body: await refused.json() };
  const funds = await fetch(`http://localhost:8797/api/funds?owner=${OWNER}`, {
    headers: { "x-remora-network": "testnet" },
  });
  results.funds = await funds.json();
  console.log(
    "networks",
    JSON.stringify(results.networks),
    "\nmainnet refusal",
    JSON.stringify(results.mainnetRefusal),
  );

  // 2. B4: a remora key, sealed in Postgres.
  const signer = new RemoraSigner(new PgKeyStore(db), parseKek(env.KEY_ENCRYPTION_KEY ?? ""));
  const remoraId = `w1-e2e-${Date.now()}`;
  const remora = await signer.create(remoraId, "testnet");
  console.log("remora", remoraId, remora);

  // 3. The owner issues its Disc (owner signs and pays gas: an owner action, not sponsored).
  const issueTx = buildIssue(cfg, {
    name: remoraId,
    spender: remora,
    lifetimeCap: 200_000n,
    expiryMs: Date.now() + 7 * 24 * 3600_000,
    payees: [MERCHANT],
    perPaymentCap: 20_000n,
  });
  const issued = await client.signAndExecuteTransaction({
    transaction: issueTx,
    signer: owner,
    include: { effects: true, objectTypes: true },
  });
  const it = issued.Transaction ?? issued.FailedTransaction;
  if (!it.effects?.status.success)
    throw new Error(`issue failed ${JSON.stringify(it.effects?.status)}`);
  await client.core.waitForTransaction({ digest: it.digest });
  const created = (suffix: string) =>
    it.effects?.changedObjects.find(
      (o) =>
        o.idOperation === "Created" && it.objectTypes?.[o.objectId]?.match(typeMatcher(suffix)),
    )?.objectId ?? "";
  const disc = {
    discId: created("::disc::Disc"),
    allowanceId: created("::allowance::Allowance<"),
    funder: OWNER,
  };
  results.issue = { digest: it.digest, ...disc };
  console.log("issued", it.digest);

  // 4. D1: indexer on, watching for this Disc's Paid.
  let paidSeen: (() => void) | null = null;
  const sawPaid = new Promise<void>((r) => {
    paidSeen = r;
  });
  const stopIndexer = startIndexer({
    network: "testnet",
    packageId: cfg.packageId,
    client,
    db,
    log,
    onFrame: (_c, rows) => {
      if (rows.some((r) => r.type === "Paid" && r.discId === normalizeSuiAddress(disc.discId)))
        paidSeen?.();
    },
  });

  // 5. The W1 exit: the remora pays sui-risk through its Disc.
  const before = await getFundsSplit(client.core, OWNER, cfg.coinType);
  const intent = {
    trigger: { kind: "message" as const, ref: "e2e" },
    inputs: { via: "tatum" as const, objects: [], sha256: SHA },
    memories: [],
    model: { id: "e2e", promptSha256: SHA },
    sonar: { verdict: "allow" as const, reasons: [] },
    decision: { payee: "reef:sui-risk", reason: "check the Disc package before trusting it" },
  };
  const { response, receipt } = await payWithDisc(
    { db, signer, networks, log },
    {
      remoraId,
      network: "testnet",
      url: `http://localhost:8799/sui-risk/${cfg.packageId}`,
      disc,
      maxAmount: 20_000n,
      intent,
    },
  );
  const report = await response.json();
  if (response.status !== 200 || !receipt?.txDigest)
    throw new Error(`pay failed ${response.status} ${JSON.stringify(report)}`);
  const digest = receipt.txDigest;
  results.pay = {
    digest,
    status: response.status,
    intentHash: receipt.intentHash,
    report: (report as { report: unknown }).report,
  };
  console.log(
    "paid",
    digest,
    "report flags",
    JSON.stringify((report as { report: { flags: string[] } }).report.flags),
  );

  // 6. Checks: sponsored gas, owner's address balance down by the price, Paid.intent == Wake hash.
  const res = await client.core.getTransaction({
    digest,
    include: { transaction: true, events: true, balanceChanges: true },
  });
  const tx = res.Transaction ?? res.FailedTransaction;
  const gasOwner = normalizeSuiAddress(tx.transaction?.gasData.owner ?? "");
  const sender = normalizeSuiAddress(tx.transaction?.sender ?? "");
  const [paid] = paidEvents(cfg, tx.events);
  const after = await getFundsSplit(client.core, OWNER, cfg.coinType);
  results.checks = {
    sponsored: gasOwner !== sender && sender === normalizeSuiAddress(remora),
    gasOwner,
    ownerAddressBalanceDelta: (after.addressBalance - before.addressBalance).toString(),
    paidIntentMatchesWake:
      !!paid && Buffer.from(paid.intent).toString("hex") === receipt.intentHash,
    merchantCredited: tx.balanceChanges?.find(
      (b) => normalizeSuiAddress(b.address) === normalizeSuiAddress(MERCHANT),
    )?.amount,
  };
  console.log("checks", JSON.stringify(results.checks));

  // 7. D1 + G2: the indexer stores Paid and anchors the Wake; the D2 job agrees.
  await Promise.race([
    sawPaid,
    new Promise((_, rej) => setTimeout(() => rej(new Error("indexer timeout")), 90_000)),
  ]);
  const rows = await db.select().from(discEvents).where(eq(discEvents.txDigest, digest));
  await runOnce(db, { [WAKE_ANCHOR]: wakeAnchorHandler({ db, networks, log }) }, log);
  const [r] = await db.select().from(receipts).where(eq(receipts.id, receipt.id));
  results.indexer = {
    rows: rows.map((x) => ({ type: x.type, checkpoint: x.checkpoint.toString() })),
    anchored: r?.anchored,
  };
  console.log("indexer", JSON.stringify(results.indexer));
  stopIndexer();

  // 8. Negatives.
  const attempt = async (
    label: string,
    url: string,
    network: "testnet" | "mainnet" = "testnet",
  ) => {
    try {
      const out = await payWithDisc(
        { db, signer, networks, log },
        { remoraId, network, url, disc, maxAmount: 30_000n, intent },
      );
      const body =
        out.response.status === 402
          ? ((await out.response.json()) as PaymentRequired).error
          : out.response.status;
      results[label] = { refused: out.response.status !== 200, detail: body };
    } catch (err) {
      const e = err as DiscFetchError & { code?: string };
      results[label] = { refused: true, detail: `${e.code ?? e.name}: ${e.message.slice(0, 160)}` };
    }
    console.log(label, JSON.stringify(results[label]));
  };
  await attempt("over per-payment cap", "http://localhost:8799/pricey");
  await attempt("payee not in the Disc", "http://localhost:8799/stranger");
  await attempt("sponsor budget out", "http://localhost:8801/x");
  await attempt("mainnet refused", `http://localhost:8799/sui-risk/${cfg.packageId}`, "mainnet");
} finally {
  writeFileSync(
    join(here, ".results.testnet.json"),
    `${JSON.stringify(results, (_, v) => (typeof v === "bigint" ? `${v}` : v), 2)}\n`,
  );
  for (const s of servers) s.close();
}
process.exit(0);
