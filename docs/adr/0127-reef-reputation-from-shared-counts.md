# ADR-0127: Reef reputation from shared counts; the planner skips what owners rate as noise

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 A2, [ADR-0119](0119-u18-learning-loop-everyday-money.md))

## Context
Each remora learns which sources are worth it: thumbs on answers move its own `source_stats`, and the
score is written to its `sources` memory. That learning stayed inside one remora. Across remoras the
data was already there (payment, refusal and answer events), but nothing aggregated it. The Reef
showed every service the same way, whether it settled every call or was mostly noise.

## Decision
- **A score per Reef service, over the last 7 days** (`money/reputation.ts`), from
  `remora_events`:
  - paid calls (Disc payments, not the owner's own approved ones) and the distinct owners behind
    them;
  - refusals after the 402 (`x402.unsettled`, whose events now carry the payee);
  - thumbs up and down on answers that paid it;
  - the median time from the first request to the settled answer (payment events now carry `ms`).
- **Opt-in per remora:** `config.share.stats` (an optional `RemoraConfig` field), off by default,
  switched on the remora's Settings with `PUT /api/remoras/:id/share`. Counts only, never a
  question, an answer or an owner's amounts.
- **"new" until there's enough:** under 3 owners and 20 calls, a card says "new". After that it reads
  like "92% useful · 214 paid calls · 6 owners · last 7 days", plus settled share and median time.
- **The planner uses it:** it skips a service under 40% useful after 20 or more rated answers, in
  both the plan and the model's own purchases. The skip is in the answer's note, the Wake's reason
  (so Why? shows it) and the answer event (`skipped`). A score never overrides the owner's payees
  or the ADR-0109 guard; with only house services there's no second service for the same need, so
  "prefer the higher score" applies only when listings overlap.
- **Where it shows:** `/api/reef/services` carries each service's `ref` and `score` (optional
  `ReefService` fields), on the Reef page and `/stats`. The scores are cached in memory and
  refreshed every 5 minutes.

## Consequences
- One remora's lesson ("this source is noise") becomes every sharing owner's, without sharing
  memory or content.
- Small networks show "new" for a while; that's honest, not a bug.
- A merchant can't buy a good score without paid calls from 3 owners, but colluding owners could
  rate it up; the score is a hint the planner uses only to skip, never to pay more.

## Links
- `apps/server/src/money/reputation.ts`, `apps/server/src/runtime/scout.ts` (`skipReason`).
- [ADR-0074](0074-memory-facts-and-admission.md), [ADR-0109](0109-pay-only-at-listed-address.md).
