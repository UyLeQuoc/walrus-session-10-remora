# ADR-0108: Document a football agent vertical for Track 2 without changing the shipped scope

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Huấn (requested a detailed PRD and a documentation commit to main; prepared by his agent)

## Context

Huấn asked for football ideas that reuse Remora's infrastructure, liked the VAR/Touchline direction,
and requested a thorough PRD for "Track 2", including football APIs and reuse. The official event
calls Track 2 Smart Agents for Real Life; Markets & Sports Prediction is Track 1. ADR-0001 still
commits the team to one Track 2 entry.

The checkout contains Scout, budgets, payments, memory, receipts and learning UI, but its odds
merchant is demo data. Its rooms contain one owner's agents, not multiple authenticated fans.
Receipts' pick'em implementation was moved to a separate repo under ADR-0065. Football providers'
terms also distinguish app usage from resale of raw data.

## Decision

- Add a Vietnamese [football-agent PRD](../prd/football-agent-track-2.md) as a proposed vertical of
  Remora, with the autonomous research agent as the Track 2 story and personal predictions as a
  learning/evaluation mechanism. Group pick'em and timestamp proofs are later slices.
- Record the current interpretation of "Track 2" explicitly. A switch to a separate Track 1 entry
  requires a subsequent decision; this ADR does not supersede ADR-0001.
- Separate verified repository capabilities and vendor-documentation facts from proposed features,
  acceptance targets and untested integration assumptions.
- Recommend a provider stack and a zero-subscription alternative for a future coverage/entitlement
  spike. No vendor is purchased or integrated by this documentation change.
- Require rights-cleared research for a paid merchant; do not propose reselling a raw football or
  odds feed through x402. Preserve existing gRPC-only Sui access and ADR-0097's visible fallback.
- Keep the ship set, existing contracts, DB, deployment and submission unchanged. Backend requests
  go to an [ownership handoff](../handoffs/2026-11-04-huan-to-uy-football-agent-prd.md).

## Consequences

The team gets an implementation-ready planning reference with source URLs, cost assumptions,
scoring, memory, failure states, acceptance criteria and build gates. Accepting this ADR accepts
the documentation and its boundaries, not a claim that the football vertical is built, that
vendors have granted redistribution permission, or that launch work is reprioritized.

Implementation needs a claimed goal, the normal contract workflow and owner decisions on vendor
budget, rights and rollout. No Move publication or deployment is authorized by this ADR.

## Links

- [PRD](../prd/football-agent-track-2.md)
- [Docs index](../README.md)
- [ADR-0001](0001-track-2-only-remora.md)
- [ADR-0061](0061-receipts-sources-and-design.md)
- [ADR-0065](0065-split-receipts-and-kitty-repos.md)
- [ADR-0097](0097-public-fullnode-fallback-when-tatum-is-out-of-credits.md)
