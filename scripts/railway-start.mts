/**
 * The whole backend in one Railway service (ADR-0099): the facilitator, the demo merchants and the API
 * run as three processes in one container and reach each other on localhost, so there is one service
 * to pay for and one set of variables. When any of them exits, the others are stopped and the
 * container exits non-zero, so Railway restarts all three.
 *   node scripts/railway-start.mts
 */
import { type ChildProcess, spawn } from "node:child_process";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const FACILITATOR_PORT = "8798";
const MERCHANTS_PORT = "8799";
const local = {
  FACILITATOR_URL_TESTNET: `http://127.0.0.1:${FACILITATOR_PORT}`,
  MERCHANTS_URL_TESTNET: `http://127.0.0.1:${MERCHANTS_PORT}`,
};

const apps = [
  { name: "facilitator", entry: "src/main.ts", env: { FACILITATOR_PORT } },
  { name: "merchants", entry: "src/main.ts", env: { MERCHANTS_PORT, ...local } },
  { name: "server", entry: "src/index.ts", env: local },
];

const kids = new Set<ChildProcess>();
let code = 0;

function stop(exitCode: number) {
  if (code === 0) code = exitCode;
  for (const k of kids) k.kill("SIGTERM");
  setTimeout(() => process.exit(code), 10_000).unref();
}

for (const app of apps) {
  const cwd = join(ROOT, "apps", app.name);
  // `node --import tsx`, not the tsx CLI, which wraps each app in a second node process (~55 MB).
  const kid = spawn(process.execPath, ["--import", "tsx", app.entry], {
    cwd,
    env: { ...process.env, ...app.env },
    stdio: "inherit",
  });
  kids.add(kid);
  kid.on("exit", (c, signal) => {
    kids.delete(kid);
    console.log(
      JSON.stringify({ level: "warn", msg: "process.exit", app: app.name, code: c, signal }),
    );
    if (kids.size === 0) process.exit(code || 1);
    stop(1);
  });
}

process.on("SIGTERM", () => stop(143));
process.on("SIGINT", () => stop(130));
