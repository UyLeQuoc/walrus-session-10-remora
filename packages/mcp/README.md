# @remora/mcp

Remora as an MCP server (F9, ADR-0048): `remoras_list`, `remora_recall` (namespaces `remora:<id>:<namespace>`) and `wake_get`. Remora's memories live in Remora's own Walrus Memory account, so this server maps their namespaces onto the Remora API, signed in as you. It speaks MCP's stdio transport directly (no SDK).

```bash
claude mcp add remora -e REMORA_SESSION=<your session> -- bun <repo>/packages/mcp/src/bin.ts
# REMORA_API_URL defaults to http://localhost:8787, REMORA_NETWORK to testnet
```

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** F9·be
- **Status:** v1: stdio server with three read-only tools, tested.
