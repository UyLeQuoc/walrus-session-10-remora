# ADR-0014: Sonar: defense in depth before any payment or send

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
Prompt injection is unsolved (Meta says so about Muse). Onchain limits cap the damage, but they don't stop
bad intents within those limits.

## Decision
Every pay or send action goes through four layers:

1. a trusted-intent builder: untrusted web and tool output can't add payees or amounts;
2. a deterministic policy;
3. an independent check model;
4. the Disc onchain.

Every verdict goes into the Wake.

## Consequences
- The demo shows Sonar blocking an injected payment. When it's forced past Sonar, the Disc aborts
  onchain.
- The red-team suite (I3) is backlog.

## Links
- [remora-spec.md §12.4](../remora-spec.md#124-sonar-pre-action-check-i1-i2)
