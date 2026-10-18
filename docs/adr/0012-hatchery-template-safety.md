# ADR-0012: Hatchery: share and duplicate remoras, with safety invariants

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
Sharing a remora as a template helps presentation, creativity and growth. But a malicious template could
carry a poisoned persona or an attacker's payee.

## Decision
- Templates are `remora.yaml` stored as Walrus blobs, with provenance from `remora::hatchery`
  (`Published` / `Forked`).
- **Invariants:**
  - no memories, keys or raw payee addresses in a template; payees are Reef references only;
  - a consent screen on hatch;
  - a Sonar scan before publish and before hatch;
  - a hatched remora starts in shadow mode;
  - Disc limits always apply.

## Consequences
- Ship set: M1, M3–M7.
- Public remoras, memory packs, updates, ratings and analytics are backlog.

## Links
- [remora-spec.md §12.11](../remora-spec.md#1211-hatchery-share-duplicate-publish-m1m12)
