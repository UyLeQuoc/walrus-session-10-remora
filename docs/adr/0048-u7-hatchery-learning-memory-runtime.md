# ADR-0048: How the Hatchery, Proof of Learning, learning charts and memory controls run

- **Status:** Accepted
- **Date:** 2026-10-21
- **Deciders:** Uy (agent, goal U7 Phase A)

## Context
ADR-0046 fixed the shapes and ADR-0047 the Move package. Building M1–M7, G5, L1 and F4/F5/F8/F9 on the server needed more choices:
- where templates are stored on Walrus;
- how gallery rows appear;
- what the safety review checks;
- how hiding and correcting work when Walrus Memory can't delete or edit a blob (tech-reference §1.11);
- which data a "proof" may use;
- how Claude Code reaches memories that live in Remora's own Walrus Memory account (ADR-0030).

## Decision
- **Walrus storage (M3):**
  - templates go through the HTTP publisher and come back through the aggregator;
  - testnet uses the public endpoints with `permanent=true` and 50 epochs;
  - mainnet needs `WALRUS_PUBLISHER_MAINNET`, a publisher that pays WAL, which the mainnet pass sets (ADR-0024); until then, publishing on mainnet is refused plainly;
  - the server uploads the file before the owner signs; a blob whose publish is never signed is harmless public data.
- **Publish and gallery (M3, M4):**
  - a publish is confirmed from its `Published` event, whose author must be the signer;
  - gallery rows come from our confirmations and from the checkpoint indexer, through the same stream and cursor as the Disc events, with a second `emitModule` filter term;
  - the parsed file, its Markdown and its review are cached in Postgres; they're public content;
  - fork counts come from `Forked` rows;
  - opt-in stats count useful answers and Disc spend of remoras hatched here.
- **Hatch (M5):**
  - the consent screen reads the blob back from Walrus, not from the cache, and reviews it again;
  - blocked or deprecated templates are refused;
  - the hatch is U6's team import, plus `hatchery::fork` appended to the same owner transaction (one signature), and a hatch is confirmed only by a `Forked` event from the signer;
  - a shared file has no room, so the import leaves the hatcher's room alone (this fixes an empty update that failed).
- **Share links:** the page link, and `t.me/<bot>?start=tpl_<first 32 hex>`. Telegram start parameters max out at 64 characters, so it's an id prefix, and the bot answers with the page link (hatching needs the wallet).
- **Safety review (M7):**
  - deterministic checks block:
    - credentials (the scrubber);
    - injection and exfiltration phrasing in names, personas, rules and schedule questions;
    - any `0x…` address, or any watch list;
    - unknown kinds;
    - payees missing from the network's Reef;
  - the model review (`brain.review`, the check model) can only add a warning.
- **Memory controls (F4, F5, F8):** a local index, `remora_memories`, is filled by the port's `onWrite` (accepted, then stored or failed).
  - **Hide** is our own filter on recall and dedupe, and it can be undone.
  - **Correct** writes a `correction` with `[replaces:<blob>]`; the old blob is skipped from then on.
  - **Forget all** calls the relayer's `/api/forget` for one namespace (index only) and says the blobs stay until they expire. It's refused on `me`, which is shared by the owner's remoras.
  - **Expiry** is flagged under 30 days.
  - **Export** is metadata, plus text that recall returns, verified against the hash recorded at write time.
- **Proof of Learning (G5):**
  - a Sentinel decision made by a rule cites that rule's memory blob in its Wake once the blob has landed (`sentinel_rules.memory_id`);
  - a proof pairs two Wakes of one remora with the same trigger kind, the same input shape (direction and coin for chain events, the question otherwise) and different actions, where the later Wake used blobs the earlier one didn't;
  - nothing is inferred beyond the Wakes.
- **Learning series (L1):**
  - Sentinel: `noise_rate` (pings marked 👎 out of all pings);
  - Scout: `cost_per_useful` (Disc spend divided by answers marked 👍; the owner's own one-off payments are excluded) and `memory_hit_rate` (answers that used a memory and bought nothing);
  - one point per UTC day with data, and an owner-wide JSON export for the blog.
- **MCP (F9):**
  - `@remora/mcp` is a stdio MCP server written without an SDK (newline-delimited JSON-RPC 2.0: `initialize`, `tools/list`, `tools/call`, `ping`);
  - it signs in as the owner with their `x-remora-session`;
  - it maps `remora:<id>:<namespace>` onto `GET /api/remoras/:id/memory?q=&ns=`;
  - its tools are `remoras_list`, `remora_recall` and `wake_get`, all read-only.

## Consequences
- `.env.example` documents `WALRUS_PUBLISHER_*`, `WALRUS_AGGREGATOR_*` and `WALRUS_TEMPLATE_EPOCHS_*`.
- New tables: `hatchery_templates`, `hatchery_forks` and `remora_memories`, plus `sentinel_rules.memory_id`. A local DB needs `drizzle-kit push`.
- The mainnet pass adds the mainnet publisher and the mainnet hatchery publish.

## Links
- ADR-0012, ADR-0021, ADR-0024, ADR-0030, ADR-0042, ADR-0046, ADR-0047; `docs/tech-reference.md` §1.11
- `apps/server/src/hatchery/*`, `apps/server/src/runtime/{learning,memory,memory-controls,sentinel,teams}.ts`, `packages/mcp`
