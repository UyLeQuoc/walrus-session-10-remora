# ADR-0107: U16 runs without Huấn: no claim, no handoff, schema changes in the same PR

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Uy

## Context
Goal U16 ([ADR-0106](0106-wow-pass-more-uses.md)) followed the usual way of working:
- a claim note before touching Huấn's lane (`apps/web`, `e2e/`);
- a landed handoff after;
- any `packages/schema` change through a contract PR that Huấn approves (AGENTS.md). Until he
  approved, the Briefer would have waited.

The submission is due Nov 10. On Nov 4 Uy said: "làm hết đi không cần giao Huấn". In other words,
do all of it, and hand nothing to Huấn.

## Decision
For goal U16:
- **Uy's agent does every part,** Huấn's lane included. It writes no claim note and no landed
  handoff.
- **A needed `packages/schema` change goes in the same PR as the code that needs it.** The PR body
  says what the contract change is. Uy owns the decision; nothing waits for Huấn's approval.
- **Everything else in AGENTS.md still holds:**
  - an ADR for each decision;
  - Sui over gRPC only;
  - testnet only;
  - no deploy without Uy's yes;
  - no secrets in commits;
  - the checks before each push.
- **The PR stays readable for Huấn afterwards.** Its body lists what changed in his lane.

This supersedes, for U16 only, ADR-0106's line that a schema change is a contract PR for Huấn.

## Consequences
- **The Briefer no longer waits on a contract approval.**
- **Two fewer documents for U16:** the claim and the landed notes.
- **Contract changes:** Huấn may find them when he next pulls. The exit note lists each one.

## Links
- [ADR-0106](0106-wow-pass-more-uses.md)
- [Goal U16](../goals/uy-16-wow-pass.md)
- AGENTS.md
