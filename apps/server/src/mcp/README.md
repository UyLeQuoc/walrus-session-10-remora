# apps/server/src/mcp

MCP v2 (F14, [ADR-0066](../../../../docs/adr/0066-agents-use-the-apps-through-mcp.md),
[ADR-0067](../../../../docs/adr/0067-mcp-v2-details.md)): agents use one remora with a token its owner
made in the web.

| File | What |
|---|---|
| `tokens.ts` | Tokens (hashed secret, scopes, expiry, revoke), the call log and totals |
| `tools.ts` | The tools, one implementation for both transports |
| `rpc.ts` | JSON-RPC: initialize, tools/list by scope, tools/call with 403, 429 and logging |
| `routes.ts` | `/api/mcp/tokens*` for the owner, and `/mcp` (Streamable HTTP) for agents |
| `index.ts` | Wiring to the real runtime |

The attack evals are in `evals/mcp-attacks.json`; `attacks.test.ts` runs them in CI.

- **Owner:** Uy Le (`@UyLeQuoc`)
- **Features:** F14·be
