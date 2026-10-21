# ADR-0050: A correction waits 60 s for the relayer, and a timeout is "try again"

- **Status:** Accepted (it changes one line of ADR-0049)
- **Date:** 2026-10-22
- **Deciders:** Uy (agent, goal U7 Phase C)

## Context
ADR-0049 bounded a write the owner waits on (a correction) at 30 s. In the full e2e suite, after W2 and U6 had used much of the operator account's relayer budget, a correction's dedupe recall plus submit took longer than 30 s. The route then answered 500 "Something went wrong" for what is a busy relayer, not a server failure.

## Decision
- A remora write the owner waits on gives up after **60 s**. Recall stays at 15 s, because a reply never waits on memory.
- A memory timeout (`MemoryTimeout`) answers **409 `relayer.slow`** with the copy sentence ("Memory is slow right now…"), on every runtime route.

## Consequences
- A correction during a busy hour succeeds, or tells the owner to try again; it never shows a server error.

## Links
- ADR-0049 (supersedes its 30 s line); `apps/server/src/runtime/{memory,routes}.ts`
