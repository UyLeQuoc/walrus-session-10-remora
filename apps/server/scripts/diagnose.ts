/**
 * `bun run diagnose` (K2, ADR-0052): the deploy gate. Checks every DEPLOYMENTS id onchain with its
 * Move type, Tatum, the relayer's /config and delegates, Walrus and the facilitator, for each
 * network this server can reach. Prints what failed and how to fix it, and exits non-zero when
 * anything is down. `--json` prints the reports instead. Never prints a key.
 */
import type { DiagnoseReport } from "@remora/schema";
import { networks } from "../src/money/index.ts";
import { liveDiagnose } from "../src/ops/index.ts";

const json = process.argv.includes("--json");
const only = process.argv.find((a) => a === "testnet" || a === "mainnet") as
  | "testnet"
  | "mainnet"
  | undefined;
const targets = networks
  .list()
  .filter((n) => n.available && (!only || n.network === only))
  .map((n) => n.network);

const reports: DiagnoseReport[] = [];
for (const network of targets) reports.push(await liveDiagnose(network));

if (json) {
  console.log(JSON.stringify(reports, null, 2));
} else {
  if (!targets.length) console.log("No network is available here: set the Tatum keys first.");
  for (const r of reports) {
    console.log(`\n${r.network}: ${r.ok ? "ok to deploy" : "DON'T DEPLOY"} (${r.status})`);
    for (const i of r.items) {
      const mark = i.status === "ok" ? "  ok  " : i.status === "degraded" ? "  warn" : "  FAIL";
      console.log(`${mark}  ${i.name}: ${i.detail}`);
      if (i.fix) console.log(`        fix: ${i.fix}`);
    }
  }
}
process.exit(reports.length && reports.every((r) => r.ok) ? 0 : 1);
