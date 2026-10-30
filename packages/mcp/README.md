# @remora/mcp

Remora as an MCP server on stdio.

- **v2 (F14, [ADR-0066](../../docs/adr/0066-agents-use-the-apps-through-mcp.md), [ADR-0067](../../docs/adr/0067-mcp-v2-details.md)):**
  with a token from the web's **Connections** page, every message goes to the server's Streamable HTTP
  endpoint (`/mcp`). The agent then has the token's tools:
  - `remoras_list`;
  - `remora_recall` (each memory that no longer holds is marked, with what holds now, F15);
  - `remora_facts` (what the remora holds true now or as of a date, disputes apart; F15,
    [ADR-0074](../../docs/adr/0074-memory-facts-and-admission.md));
  - `remora_remember` (episode or source; a rule waits for the owner; in the facts ledger an agent's
    claim never outranks the owner's);
  - `reef_search`;
  - `pay` (through the remora's Disc);
  - `approval_request`;
  - `wake_verify`;
  - `remora_ask`.

  ```bash
  claude mcp add remora -e REMORA_MCP_TOKEN=rmcp_… -e REMORA_API_URL=<server> -- bun <repo>/packages/mcp/src/bin.ts
  # or, without the repo, over HTTP:
  claude mcp add --transport http remora <server>/mcp --header "Authorization: Bearer rmcp_…"
  ```
- **v1 (F9, [ADR-0048](../../docs/adr/0048-u7-hatchery-learning-memory-runtime.md)):** with
  `REMORA_SESSION`, three read-only tools (`remoras_list`, `remora_recall` and `wake_get`), signed in as
  you.

It speaks MCP's stdio transport directly (newline-delimited JSON-RPC, no SDK).

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** F9·be, F14·be, F15·be
- **Status:** v2 is a stdio → `/mcp` proxy and is tested; v1 is kept.
