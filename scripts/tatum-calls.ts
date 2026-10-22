/**
 * L2: the list of Sui gRPC calls Remora makes through Tatum (ADR-0021: gRPC only), generated from
 * the code so the README can't drift. Writes the table between the README's markers;
 * `--check` fails instead when the README is out of date (CI).
 *   bun scripts/tatum-calls.ts [--check]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
/** Server-side code, which talks to Sui through Tatum (the browser and memory's lookups don't; see README). */
const SCAN = [
  "apps/server",
  "apps/facilitator",
  "apps/merchants",
  "packages/chain",
  "packages/disc-sdk",
  "packages/merchant",
  "packages/sonar",
];

/** Sui gRPC methods (core client and raw services), with the service and what Remora uses them for. */
const METHODS: Record<string, { service: string; use: string }> = {
  subscribeCheckpoints: {
    service: "SubscriptionService",
    use: "Sentinel's watcher and the checkpoint indexer (Disc and hatchery events): one stream per network",
  },
  getCheckpoint: {
    service: "LedgerService",
    use: "backfill the checkpoints missed during a reconnect",
  },
  getServiceInfo: {
    service: "LedgerService",
    use: "the chain tip for health's checkpoint lag and Tatum latency, and diagnose",
  },
  getObject: {
    service: "LedgerService",
    use: "Disc, allowance and cap state; diagnose's Move type checks; Scout's object reads",
  },
  getTransaction: {
    service: "LedgerService",
    use: "confirm owner transactions by digest; hatchery events; Wake checks",
  },
  executeTransaction: {
    service: "TransactionExecutionService",
    use: "remora payments (sponsored) and server-signed transactions",
  },
  simulateTransaction: {
    service: "TransactionExecutionService",
    use: "the gas station and Sonar dry-run before anything is signed",
  },
  waitForTransaction: { service: "LedgerService", use: "wait for finality before confirming" },
  getBalance: { service: "StateService", use: "funds, the playground funder, sponsor gas" },
  listBalances: { service: "StateService", use: "Scout's balance reads" },
  listCoins: { service: "StateService", use: "Detect funds (coins → address balance)" },
  getReferenceGasPrice: { service: "LedgerService", use: "transaction building" },
  getProtocolConfig: { service: "LedgerService", use: "transaction building" },
  signAndExecuteTransaction: {
    service: "TransactionExecutionService",
    use: "the SDK's sign-then-execute, for the playground funder and scripts",
  },
};

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === "build") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const where = new Map<string, Set<string>>();
for (const top of SCAN)
  for (const f of files(join(ROOT, top))) {
    if (!f.includes("/src/")) continue;
    const text = readFileSync(f, "utf8");
    for (const m of Object.keys(METHODS))
      if (new RegExp(`\\.${m}\\(`).test(text)) {
        const set = where.get(m) ?? new Set();
        set.add(relative(ROOT, f));
        where.set(m, set);
      }
  }

const rows = Object.entries(METHODS)
  .filter(([m]) => where.has(m))
  .map(([m, { service, use }]) => {
    const list = [...(where.get(m) ?? [])].sort();
    const shown = list
      .slice(0, 3)
      .map((f) => `\`${f}\``)
      .join(", ");
    return `| \`${m}\` | ${service} | ${use} | ${shown}${list.length > 3 ? ` (+${list.length - 3})` : ""} |`;
  });
const table = [
  "| Call | gRPC service | What Remora uses it for | Where |",
  "|---|---|---|---|",
  ...rows,
].join("\n");

const START = "<!-- tatum-calls:start -->";
const END = "<!-- tatum-calls:end -->";
const readmePath = join(ROOT, "README.md");
const readme = readFileSync(readmePath, "utf8");
const i = readme.indexOf(START);
const j = readme.indexOf(END);
if (i < 0 || j < 0) {
  console.error("README.md has no tatum-calls markers.");
  process.exit(1);
}
const next = `${readme.slice(0, i + START.length)}\n${table}\n${readme.slice(j)}`;
if (process.argv.includes("--check")) {
  if (next !== readme) {
    console.error("README.md's Tatum call list is out of date: run bun scripts/tatum-calls.ts");
    process.exit(1);
  }
  console.log(`Tatum call list is current (${rows.length} calls).`);
} else {
  writeFileSync(readmePath, next);
  console.log(`Wrote ${rows.length} calls into README.md.`);
}
