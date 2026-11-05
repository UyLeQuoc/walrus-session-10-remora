# ADR-0136: The replay bench, and memory that narrows the plan

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
- Best Walrus Memory rewards "the deepest learning loop". Until now a Researcher's purchases were
  planned from the question alone (`planBuys`) plus the Reef's shared floor (ADR-0127): its own
  memory changed what the model wrote, but not what it bought. A judge couldn't see a decision change
  *because of* memory.
- U18 already had the pieces: `SOURCE` track records per service in memory, the facts ledger with
  `asOf` (ADR-0074), the local index of every write with its time (`remora_memories`), shadow mode.

## Decision
- **Memory narrows the plan** (`plan-memory.ts`), in every live turn and in a replay:
  - rules the owner accepted (ADR-0137) skip or ask before a planned purchase;
  - its notes: a service whose track record in the ledger has at least 3 rated answers and under 34%
    useful is skipped;
  - each skip says why ("skipped odds: your rule from Nov 6 (…)", "my notes say 0 of 3 rated answers
    from it were useful") and cites its blob ids, which also go into the Wake's `memories`.
  - Nothing here adds a purchase; the model's own follow-up buys pass the same check.
- **The replay bench** (`replay.ts`): up to 12 questions, each planned three ways:
  - `none`: no recall, facts, rules or notes;
  - `t0`: recall filtered to blobs our index recorded before T₀ (a blob we never recorded is left
    out), admission against the ledger at T₀, rules accepted by T₀, track records in effect at T₀;
  - `today`.
- **A replay is a plan, never a purchase.** It never calls the pay path: a stub records "would buy X
  for its listed price". It never writes memory, feedback or source stats, and never notifies. The
  model and the daily token cap are the remora's own (12 questions = 36 planned turns). The Reef's
  shared floor applies equally in every column, since it isn't this remora's memory.
- **API:** `POST /api/remoras/:id/replay` (owner only, one at a time per remora, at most 3 an hour),
  `GET …/replay/:runId`, `GET …/replay`. Each run is one `replay.ran` event holding the plans, the
  differences (each with its reason and cited blobs) and the totals. No schema change.
- **Honesty:** every replay number is labeled "planned in a replay on <date>"; a run with no
  difference says so; answers aren't scored by a model.

## Consequences
- The landing and video can lead with "the same ten questions, three times", each skip linking a
  memory blob.
- A Researcher whose owner rates a service noise three times stops buying it until a useful rating
  lifts the share; the owner sees why in the answer and in Why?.

## Links
- ADR-0074, ADR-0124, ADR-0127, ADR-0134; `docs/goals/uy-19-it-gets-better.md` A1
