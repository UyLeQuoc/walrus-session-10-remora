#!/usr/bin/env bun
/**
 * `bun packages/mcp/src/bin.ts`: Remora's MCP server on stdio.
 * - MCP v2 (F14, ADR-0066): with REMORA_MCP_TOKEN (made in the web's Connections page) every message
 *   goes to the server's /mcp, so the agent gets the token's tools: memory, Reef payments through the
 *   remora's Disc, approval requests.
 *     claude mcp add remora -e REMORA_MCP_TOKEN=rmcp_… -e REMORA_API_URL=<server> -- bun <repo>/packages/mcp/src/bin.ts
 * - MCP v1 (F9): with REMORA_SESSION, the three read-only tools, signed in as you.
 * REMORA_API_URL defaults to http://localhost:8787 and REMORA_NETWORK (v1 only) to testnet.
 */
import { runProxyStdio } from "./proxy.ts";
import { runStdio } from "./server.ts";

const apiUrl = process.env.REMORA_API_URL ?? "http://localhost:8787";
const token = process.env.REMORA_MCP_TOKEN;
const session = process.env.REMORA_SESSION;
if (token) {
  runProxyStdio({ apiUrl, token });
} else if (session) {
  runStdio({
    apiUrl,
    session,
    network: process.env.REMORA_NETWORK === "mainnet" ? "mainnet" : "testnet",
  });
} else {
  process.stderr.write(
    "Set REMORA_MCP_TOKEN (the web's Connections page) or REMORA_SESSION (read-only, v1).\n",
  );
  process.exit(1);
}
