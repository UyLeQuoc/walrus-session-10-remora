# ADR-0135: Walrus Memory SDK 0.1.12 and the index check

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
- `@mysten-incubation/memwal` was on `^0.1.8` (resolved 0.1.8). 0.1.9 added `listMemories()`, the
  relayer's documented walk of an account's memories (metadata only, paginated with `has_more`);
  0.1.11 added `dedupe: true` on remember; 0.1.12 added input caps. 0.1.13 is out too, but the goal
  scoped 0.1.12 and we don't take a version we haven't read.
- We already listed memories through our own signed request (`RelayerExtras.allMemories`, ADR-0049)
  and compared counts per namespace (F6), but a gap showed no blob ids, and `diagnose` didn't check it.
- Measured on Nov 5, 06:5x UTC against the operator account: the SDK's walk and ours both returned
  746 memories in 320 namespaces, the same 746 blob ids (610 ms vs 264 ms).

## Decision
- Pin `@mysten-incubation/memwal` to exactly `0.1.12` in `packages/memory` and `apps/web` (inside the
  old `^0.1.8` range; exact so a fresh install can't drift to 0.1.13).
- `RelayerExtras.listAll()` walks `listMemories()`; the inspector's listing uses it, and falls back to
  our signed listing only if the relayer refuses the SDK's route.
- **The index check:** per namespace, the blobs `remora_memories` recorded as `stored` against what
  `listMemories()` lists. The Memory Inspector shows "written N · on Walrus Memory N · missing N" with
  up to 20 missing blob ids; `diagnose` checks the last 7 days of stored writes. A gap is a warning
  with ids; nothing is re-written or restored.
- **Relayer-side dedupe (`dedupe: true`) is not switched on.** Our dedupe is semantic (recall
  distance) and skips near-duplicates, which a content-hash key can't; ADR-0074 also writes `SOURCE`
  lines with `dedupe: false` on purpose. The measurement is in the U19 exit note.

## Consequences
- The inspector and `diagnose` can name a lost write by its blob id.
- `listMemories()` lists the whole operator account (the namespace filter is client-side), so the
  listing stays cached for 30 s as before (ADR-0049).

## Links
- [Walrus Memory release notes](https://docs.wal.app/docs/release-notes/walrus-memory)
- ADR-0049 (inspector listing), ADR-0074 (facts ledger), ADR-0086 (duplicates shown)
