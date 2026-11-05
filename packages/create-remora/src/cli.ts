#!/usr/bin/env node
/**
 * `npx create-remora my-api` (ADR-0140): a paid API in one command, from examples/sell-an-api.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nextSteps, packageManager, scaffold } from "./scaffold.ts";

const USAGE = `Usage: create-remora <folder>

Scaffolds a paid API in <folder>: x402 and MPP in USDC on Sui testnet, through @getremora/merchant.
The folder must be new or empty.`;

const target = process.argv[2];
if (!target || target === "-h" || target === "--help") {
  console.log(USAGE);
  process.exit(target ? 0 : 1);
}

// Published, the template sits beside cli.js; in the repo, beside src/.
const templateDir = ["./template/", "../template/"]
  .map((p) => fileURLToPath(new URL(p, import.meta.url)))
  .find((p) => existsSync(p));
if (!templateDir) {
  console.error("create-remora: its template folder is missing; reinstall it.");
  process.exit(1);
}

const cwd = process.cwd();
const made = scaffold({ target, templateDir, cwd });
if (!made.ok) {
  console.error(`create-remora: ${made.reason}`);
  process.exit(1);
}
console.log(
  nextSteps({
    dir: made.dir,
    name: made.name,
    cwd,
    pm: packageManager(process.env.npm_config_user_agent),
  }),
);
