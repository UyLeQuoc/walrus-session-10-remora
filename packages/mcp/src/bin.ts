#!/usr/bin/env bun
/**
 * `bun packages/mcp/src/bin.ts`: Remora's MCP server on stdio (F9). Configure it in Claude Code with
 *   claude mcp add remora -e REMORA_SESSION=<your session> -- bun <repo>/packages/mcp/src/bin.ts
 * REMORA_API_URL defaults to http://localhost:8787 and REMORA_NETWORK to testnet.
 */
import { runStdio } from "./server.ts";

const session = process.env.REMORA_SESSION;
if (!session) {
  process.stderr.write(
    "REMORA_SESSION is not set: copy it from the dashboard (Memory → Claude Code).\n",
  );
  process.exit(1);
}
runStdio({
  apiUrl: process.env.REMORA_API_URL ?? "http://localhost:8787",
  session,
  network: process.env.REMORA_NETWORK === "mainnet" ? "mainnet" : "testnet",
});
