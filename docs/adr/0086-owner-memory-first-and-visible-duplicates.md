# ADR-0086: The owner's memories rank first, and skipped duplicates are shown

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (asked for both after reading Dewee's memory docs; built by Uy's agent)

## Context
Uy asked for two ideas from
[Dewee's memory docs](https://dewee.sh/vi/docs/concepts/memory-and-knowledge). We read only the docs,
not any code.
- **A person's own memory outranks shared agent memory.**
  - Dewee multiplies its search score by 1.2 for a user's personal memory.
  - When both scopes hold the same chunk, the personal one wins.
- **Near-duplicates are flagged for review, not dropped.** Dewee's dedupe scan flags pairs at 0.90
  similarity or more, and someone merges or dismisses them.

What Remora did:
- **Admission ranked by distance alone** ([ADR-0074](0074-memory-facts-and-admission.md)).
  - The ledger knew who asserted each fact: owner > runtime > agent > extractor.
  - But an agent's near-copy that recall put a little closer was read first. Under a cap, it could
    push out the owner's line.
- **A write within `DISTANCE.duplicate` (0.25) of a stored memory was skipped.**
  - `remora_memories` recorded it as a `duplicate` row, holding the blob it matched.
  - Nothing showed it anywhere. That is how Scout's newer track records disappeared before ADR-0074
    fixed them.
  - The inspector also read those rows as if they were the matched memory's own, so a skipped
    `episode` could relabel a `rule`.

## Decision
- **Owner first.**
  - The ledger's `validity` also returns `owner`: the recalled blobs that a live, owner-asserted fact
    rests on. Today that means owner corrections, and agent claims the owner accepted.
  - `admit` ranks those blobs as if their similarity (1 − distance) were **1.2×** higher.
  - It reorders only:
    - the owner's copy wins a tie with an agent's near-copy, and the agent's becomes the repeat;
    - a cap drops the agent's line first;
    - the distance a Wake cites stays the one recall measured.
  - It changes nothing beyond distance 1, and nothing when the ledger is off or fails (fail open).
- **Duplicates shown.**
  - Each skipped write logs `memory.duplicate_skipped` (remora, namespace, type, the matched blob).
  - The inspector API adds:
    - `duplicateWrites` on each row: how many later writes matched this memory;
    - a top-level `duplicates` list: the newest 20 skipped writes, with namespace, type, matched blob
      and time.
  - Duplicate rows no longer stand in for the memory they matched.
  - The schema change is additive with defaults, in contract PR #18. Huấn renders it.
- **Not changed:**
  - the dedupe threshold;
  - the rule that structured records skip dedupe ([ADR-0063](0063-structured-records-skip-dedupe.md),
    ADR-0074).

  Reviewing a pair and merging it, as Dewee does, needs the skipped text, and Remora doesn't keep
  memory text locally.

## Consequences
- **The owner's word reaches the model first,** in Scout's turns and in every other turn that goes
  through `admitMemories`.
- **A swallowed write is visible.**
  - An owner who sees "3 later writes matched this" can correct or hide the memory.
  - Ops can count `memory.duplicate_skipped` in the logs.
- **Server side, the API returns the new fields now.** Older clients ignore them. Until the contract
  PR merges, the web drops them when it parses the response.

## Links
- [ADR-0074](0074-memory-facts-and-admission.md) · [ADR-0063](0063-structured-records-skip-dedupe.md) ·
  [handoff to Huấn](../handoffs/2026-10-31-uy-to-huan-inspector-duplicates.md)
- `packages/memory/src/admission.ts`, `apps/server/src/runtime/facts.ts`,
  `apps/server/src/runtime/memory-controls.ts`
