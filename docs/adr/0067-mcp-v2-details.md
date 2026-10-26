# ADR-0067: MCP v2 details: one server-side implementation, refusals over the limit, scoped tool lists

- **Status:** Accepted
- **Date:** 2026-10-25
- **Deciders:** Uy's agent (goal U12)

## Context
[ADR-0066](0066-agents-use-the-apps-through-mcp.md) decided that agents use Remora through MCP, with
scoped, revocable tokens, and that money moves only inside the Disc. Building it (F14) needed some
smaller choices.

## Decision
- **One implementation.** The tools, scope checks and call log live on the server
  (`apps/server/src/mcp`), behind Streamable HTTP at `/mcp`.
  - The stdio server (`packages/mcp`, with `REMORA_MCP_TOKEN`) proxies each message to `/mcp`, so both
    transports run the same code.
  - v1's session mode stays, read-only, for anyone who set it up.
- **Tokens:**
  - `rmcp_` plus 40 random characters, shown once and stored as SHA-256;
  - bound to one remora;
  - 30 days by default, 90 at most;
  - 60 calls a minute;
  - unknown, revoked and expired tokens all get HTTP 401.
- **Scopes decide what an agent sees.** `tools/list` shows only the tools a token may call, and calling
  any other gets HTTP 403. These tools need no scope: `remoras_list`, `reef_search`, `wake_verify` and
  `wake_get`. `remora_ask` needs `pay`, because a Scout turn may buy data.
- **Over the limit, MCP refuses; it doesn't queue.**
  - A `pay` that Sonar sends to the owner ("ask") returns `over_limit` with its Wake, and nothing is
    signed.
  - The agent then asks with `approval_request`, which reads the live 402 and creates the E4 approval.
    It refuses if the service asks to be paid at an address other than the Reef's.
  - The owner pays it once in the web, as before. Payments from the web and Telegram still queue the
    approval at once.
- **`via`:**
  - The client is the slug of the token's name.
  - Every MCP action's trigger is `{ kind: "message", ref: "mcp:<client>" }`, so the onchain intent hash
    covers it, and the Wake repeats it as `via` (the contract, PR #14).
- **Memory:**
  - `remora_remember` writes `source` to `sources`, and `episode` to `episodes` (or `me` when the
    remora has no `episodes`), tagged `[by:@mcp:<client>]`.
  - A `rule` becomes an approval of kind `rule`, Sentinel only. The inbox's ordinary "Approve" teaches
    it.
- **Where agents connect:** `API_BASE_URL` (optional) is where agents reach `/mcp`, because the web's
  proxy forwards only `/api`.
- **Browser origins:** `/mcp` refuses an `Origin` that isn't one of ours (DNS rebinding).

## Consequences
- The Connections page shows each token's calls, spend and memories from `mcp_calls`.
- `evals/mcp-attacks.json` holds 10 attacks, and CI runs them against the real routes with a fake chain
  and database (`apps/server/src/mcp/attacks.test.ts`).
- U9 deploys `/mcp` and sets `API_BASE_URL` to the public API.

## Links
- [ADR-0066](0066-agents-use-the-apps-through-mcp.md), [ADR-0048](0048-u7-hatchery-learning-memory-runtime.md),
  [goal U12](../goals/uy-12-agents-mcp.md), PR #14
