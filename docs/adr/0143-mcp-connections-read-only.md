# ADR-0143: MCP connections, read-only tools only, through a hand-written client

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
Goal U19's D1 (D10 in [remora-features.md](../remora-features.md), spec in
[uy-19-it-gets-better.md](../goals/uy-19-it-gets-better.md)) lets a remora read from any MCP server
its owner plugs in. Until now MCP went one way: agents use a remora through `/mcp`
([ADR-0066](0066-agents-use-the-apps-through-mcp.md)). Here the remora is the client.

What we had and what we found:
- `packages/mcp` speaks JSON-RPC without the SDK. A client for Streamable HTTP needs `initialize`,
  `notifications/initialized`, `tools/list` and `tools/call`, JSON or SSE answers, and the
  `Mcp-Session-Id` header. No new dependency.
- `safe-fetch` blocks private addresses but only did GETs (`fetchPage`). Hooks
  ([ADR-0121](0121-price-and-webhook-triggers-outbound-hooks.md)) re-implemented the check for POSTs.
- Remora keys are sealed with an envelope (`@remora/signer`, AES-256-GCM, a data key wrapped by
  `KEY_ENCRYPTION_KEY`, the record's id as associated data).
- No schema push: per-remora settings live in `remoras.config`.
- Public servers checked on Nov 5:
  - **DeepWiki** (`https://mcp.deepwiki.com/mcp`): 3 tools (`ask_wiki_question`,
    `read_wiki_contents`, `read_wiki_structure`), no annotations, so none is read-only by our rule;
  - **Context7** (`https://mcp.context7.com/mcp`): `resolve-library-id` and `query-docs`, both
    `readOnlyHint: true, destructiveHint: false`, no key needed. A live call answered in 1.4–2.3 s;
  - Microsoft Learn, Cloudflare docs and AWS Knowledge also mark their tools read-only.

## Decision
- **Client** (`apps/server/src/mcp/client.ts`):
  - every request goes through the new `safeFetch` in `safe-fetch.ts`: https only, no credentials in
    the URL, `localhost` names and every private address refused, no redirects. `fetchPage` and it
    share one address check;
  - `allowLocal` lets a development server reach `http://localhost` (and only localhost). It's set
    only when the server isn't on Railway and `NODE_ENV` isn't production, as hooks do;
  - a call (the tool list check and the call itself) has 20 s;
  - SSE is read only until the event that answers our id, so a stream left open doesn't hang. Bodies
    are capped at 1 MB;
  - a server that forgets its session (404) gets one new `initialize`.
- **Read-only only:** a tool is offered when `annotations.readOnlyHint === true` and
  `destructiveHint !== true`. A hint that's missing, or anything but `true`, doesn't count. A server
  with no such tool is refused when added (`mcp.no_read_only`). The rule isn't relaxed for servers
  that don't annotate, DeepWiki included.
- **Config:** `config.mcp`, at most 5 servers, each `{ id, url, name, tools }` (`McpServerEntry` in
  `packages/schema`; `tools` are the ticked ones) plus, kept beside it and never parsed into a view:
  - `offered`: the read-only tools seen when it was added (name, description and arguments in one
    line, angle brackets removed);
  - `hidden`: how many tools weren't offered;
  - `tokenEnc`: an optional bearer token, sealed by `RemoraSigner.sealSecret` with the same envelope
    and key as remora keys. Its associated data is `remora-secret:<remora>:mcp:<server>`, which never
    matches a remora key's, so `openSecret` can't open one.
- **Owner routes** (mounted on the W2 app, like the ledger): `GET/POST /api/remoras/:id/mcp`,
  `PUT /api/remoras/:id/mcp/:serverId/tools`, `DELETE /api/remoras/:id/mcp/:serverId`. Adding one
  connects and lists its tools; none is ticked yet. Only an offered tool can be ticked. A view says
  `hasToken` and never carries the token or its sealed blob. Adding and removing write a feed action.
- **In a turn:** the model gets one tool, `mcp_call({ connection, tool, arguments })`, with the
  ticked tools listed in its description. `arguments` is a JSON string, so the schema stays the same
  for every model and provider. Each call:
  - counts toward 3 per turn, failed ones included;
  - must name a ticked tool that the server offered;
  - is checked against the server's live list first, so a tool it no longer marks read-only isn't
    called;
  - returns the output as untrusted data from `mcp:<host>/<tool>`, with any `</untrusted` inside it
    defused.

  Sold and playground turns never get MCP tools, since the owner's servers and tokens are theirs.
  The answer event's payload records `mcp: [{ host, tool, ok }]`, and Why? lists them.
- **Web:** Connections gets "MCP servers your remoras read": pick a remora, add a URL with an
  optional name and token, tick the read-only tools, remove a server.

## Consequences
- An owner can give a remora docs and search tools without our code changing per server. A server
  that doesn't annotate its tools, like DeepWiki, can't be used. Context7 is the live example
  instead.
- The read-only hint is the server's own claim. What keeps a dishonest server from doing harm is the
  rest: money moves only through `pay` and the Disc, and MCP outputs are data, never instructions.
- A `config_changed` event copies the raw config, so after a later settings change the sealed token
  blob can reach the owner's own feed and history. It's ciphertext under a key only the server has;
  the token itself is never returned. A secrets table would remove even that, but it needs a schema
  push.
- Follow-ups: refresh a server's tool list from the page; per-tool call counts on the card.
- Docs: `apps/server/src/mcp/README.md`.

## Links
- [ADR-0134](0134-u19-it-gets-better-and-anyone-can-check.md) (goal U19),
  [ADR-0066](0066-agents-use-the-apps-through-mcp.md) (MCP v2, the other direction),
  [ADR-0121](0121-price-and-webhook-triggers-outbound-hooks.md) (hooks' address check),
  [ADR-0109](0109-pay-only-at-listed-address.md) (pay only at listed addresses).
- MCP spec, Streamable HTTP transport and tool annotations (2025-06-18).
