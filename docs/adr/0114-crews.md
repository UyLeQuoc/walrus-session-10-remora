# ADR-0114: Crews: a team plus a lead that splits a question across its members

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U17, [ADR-0111](0111-scale-pass.md))

## Context
ADR-0111 asks that one signature start a crew. The lead splits a question's purchases across the
members, each member pays from its own Disc, and one answer cites every receipt. Team files
(ADR-0042) already create several remoras with one owner signature (`applyTeam`). A handoff
(`handoff` tool, D5) is asynchronous: it queues a job, and the answer lands in the other remora's
feed later.

## Decision
- **The team file:**
  - It gains `crew: { lead: <name> }`.
  - Each member gains `covers: [<reef slug>, …]`: the services it buys for the lead.
  - On apply, every member's config gets `crew: { id, name, leadId, covers }`, which
    `RemoraConfig` shows to the web.
  - Export writes the crew back.
  - These are additive, optional contract changes in `packages/schema` (`TeamFile.crew`,
    `TeamRemora.covers`, `RemoraConfig.crew`).
- **The lead's turn** (`leadAsk` in `scout.ts`), on any channel (thread, Ask, Telegram, MCP,
  schedules):
  1. It plans the purchases with `planBuys`.
  2. `assign` gives each one to a live member that covers its service (the least busy of them),
     else to the members in turn.
  3. Every member answers **at once**, with exactly its assigned purchases and no pay tool of its
     own. Each pays from its own Disc and keeps its answer in its own thread.
  4. The lead pays nothing. It answers from the members' answers, which go to the model as
     untrusted data, and appends one line per receipt: "Onchain paid Sui risk check 0.01 USDC
     (5pXu4R…)".
  5. The lead's answer event carries `crew: [{ member, payee, amount, digest }]`.

  With nothing to hand out, the lead answers as a Researcher would.
- **The crew page** (a card on every member's page):
  - each member, what it covers, its limit, and what it spent and paid this month, plus the crew's
    total;
  - **Pause the crew:** runtime status only, no transaction; resume restores each member's status;
  - **Retire the crew:** `retireAllTx` limited to the crew's ids, one transaction that revokes every
    member's Disc.
- **The template:** "Research crew" (a lead, plus Onchain, Markets and Code), published with
  `SEED=1`.

## Consequences
- **Synchronous:** a crew's answer waits for its slowest member. The members run in parallel, so
  it's about one member's time.
- **Gas:** a crew needs as many sponsor coins at once as it has members buying. The testnet pool has
  29 (U17 D1).
- **Members are ordinary Researchers:** they can still be asked directly in their own threads.
- **Not the old handoff:** the asynchronous `handoff` tool stays as it was, for remoras that aren't
  in a crew.

## Links
- [ADR-0111](0111-scale-pass.md)
- [ADR-0042](0042-grok-bots-shape.md)
