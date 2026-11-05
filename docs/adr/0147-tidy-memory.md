# ADR-0147: A remora tidies its memory: merges notes that say the same thing, asks when two disagree, weighs newer ratings more

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
- U19 A3 (the W3 half of F11): every 👍/👎 writes the next version of a service's track record
  (`SOURCE reef:x · N calls · U useful · K noise · … · as_of D`, feedback.ts, `dedupe: false` per
  ADR-0074), so a well-rated remora collects a blob per rating. The facts ledger keeps them as
  versions of one slot (`reef:x.track_record`), one active.
- Nothing merged them, nothing noticed two notes or two rules that disagree, and the planner's
  memory skip (ADR-0136) read the record's all-time counts, so a service that turned bad lately kept
  being bought on its old ratings.
- `policy.ts` notes that `recall({ sort: "recent" })` changes *which* memories come back, and the SDK
  says `scoringWeights` only re-rank the top-k recall already returned (a 30-day half-life barely
  moves records days apart). Neither ranks services; the ledger already holds each version's time.

## Decision
- **When:** weekly, right after the review (`review.weekly`; a failed tidy never costs the review),
  and on demand ("Tidy now", `POST /api/remoras/:id/tidy`, 6 an hour).
- **Consolidate** (`apps/server/src/runtime/tidy.ts`, pure `groupForMerge`):
  - per service, the newest run of track-record versions with the same clear verdict (mostly useful,
    or mostly noise; "mixed" never merges), ending at the record in effect, spanning at least 3 blobs
    that aren't hidden yet;
  - becomes one `sources` note that restates the newest record and names them:
    `SOURCE reef:x · <newest value> · as_of <today> · SOURCE: tidy of <blob ids>`. `parseSourceLine`
    now drops that trailing `· SOURCE: tidy of …`, so the ledger reads the note as more evidence for
    the same record (it *extends* the active fact) instead of a new value;
  - only once the note is accepted and the ledger has read it, the old blobs are hidden with F4's
    local filter (`hidden_at`). They stay on Walrus until they expire, as the Tidied tab says; the
    record never vanishes from the planner (a Postgres test checks it);
  - someone else's word (a starter pack's or an import's `SOURCE:` line) is never merged; at most 5
    merges a run.
- **Conflicts** become an `approvals` row (kind `rule_conflict`, `payload.kind = "conflict"`,
  `payload.what` = `notes` | `rules`) "Which one holds?", at most 3 a run, each pair asked once
  whatever the answer (`payload.key`), and the owner is notified:
  - **notes:** for one service, the newest version that said mostly useful and the newest that said
    mostly noise, both within the last 7 days. A track record carries no question shape, so the
    service is the scope (A2's `skip … unless <shape>` rules handle shape-dependent services);
  - **rules:** a `skip` or `ask` rule and a `prefer` rule for the same service that can apply to the
    same question (neither needs a shape the other excludes);
  - a service with an open conflict isn't consolidated until the owner answers.
- **The owner picks** (`POST /api/approvals/:id/conflict-resolve {keep}`): the other note gets a
  `[correction]` naming its blob through memory-controls `correct` (the owner's word: recall skips the
  blob, and the ledger closes what it asserted); the other rule is removed through `removeRule`
  (config history shows it) and its `[rule]` memory corrected once it has a blob. "Leave both"
  (`…/conflict-dismiss`, and the inbox's Decline) closes it without a change. The inbox's card links
  to the Tidied tab.
- **Recency** (`plan-memory.ts`): a record's ratings are re-weighed from its versions in the ledger,
  each version adding the ratings since the one before at the time it took effect, weighed
  `0.5 ^ (age / 14 days)` at the plan's time (a replay's T₀ included). The memory skip keeps its
  thresholds (3 rated answers, under 34% useful) on the weighted share, and Why? says
  "newer ratings count more, N% useful" when that changes the number.
  - Fixture measurement (unit test): 6 useful ratings 21–28 days ago, then 4 noise in the last 3
    days. All-time: 6 of 10 = 60% useful, kept. Weighted: 1.81 useful against 3.63 noise = 33%,
    skipped. Ratings on one day weigh the same as the counts.
  - MemWal `scoringWeights` isn't used: it re-ranks recalled memories, not services, and no fixture
    showed it doing better. No relayer measurement was run.
- **The Memory Inspector's Tidied tab:** each tidy (weekly or asked), what it merged, the new note's
  blob, the merged blobs ("merged and hidden, still on Walrus"), and the open conflicts with "This
  one holds" for each side.

## Consequences
- The inspector shows one note per service where there were many; recall reads the tidy note
  instead of a handful of near-identical versions.
- A service whose recent ratings turned bad is skipped sooner; one that recovered is bought again
  sooner.
- Note conflicts are judged per service, not per question shape: a tidy can ask about a service
  that is useful for one kind of question and noise for another. Answering, or A2's shape rules,
  settle it.

## Links
- [ADR-0134](0134-u19-it-gets-better-and-anyone-can-check.md), [ADR-0074](0074-memory-facts-and-admission.md),
  [ADR-0048](0048-u7-hatchery-learning-memory-runtime.md), [ADR-0128](0128-weekly-review-written-back-to-memory.md),
  [ADR-0136](0136-replay-bench.md), [ADR-0137](0137-rule-proposals-narrow-only.md).
- `apps/server/src/runtime/{tidy,plan-memory,import-tidy-routes}.ts`, `packages/memory/src/facts.ts`,
  `apps/web/src/features/memory-inspector/tidied-tab.tsx`.
