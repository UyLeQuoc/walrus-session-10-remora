# ADR-0128: A weekly "What I learned", written from a remora's own numbers back into its memory

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 A3, [ADR-0119](0119-u18-learning-loop-everyday-money.md))

## Context
A remora's learning was spread over many small rows: payments, thumbs, taught rules, proposals. An
owner had to open several tabs to see whether it got better, and the remora itself never looked
back over a week.

## Decision
- **The review's facts come from the remora's own rows** for the last 7 days (`reviewFacts`):
  - spend per day and in total, against its limit;
  - each service it bought, with the useful and noise ratings of answers that used it;
  - the owner's ratings, rules it learned, and how its budget proposals ended.
- **The model only words them:** 3–6 first-person lines, told to use only these numbers. If the
  model is down or writes fewer than two lines, plain lines built from the numbers stand
  (`plainLines`).
- **It reads last week's:** the previous review's first line is quoted, and the new one links to
  the previous (`previousId`).
- **Written back to Walrus Memory:** `REVIEW <from>..<to> · …` in the remora's `feedback`
  namespace, type `episode`. The card shows the blob once it lands.
- **When:**
  - a `review.weekly` job at Monday 09:00 in the owner's timezone (`owner_settings.timezone`); it
    queues the next week's, and the server queues one for every live remora at start
    (idempotent per week);
  - "Write it now" on the remora's Learning tab, three an hour at most.
- **Telegram:** the lines go to the owner through the notifier, so quiet hours and the notify level
  apply.

## Consequences
- The loop shows in one place each week, and the remora's next answers can recall what it
  concluded.
- A paused remora gets no review that week; its chain of jobs continues.

## Links
- `apps/server/src/runtime/review.ts`, `apps/web/src/features/remoras/review-card.tsx`.
- [ADR-0124](0124-budget-proposals-cite-memories.md) (proposals the review reports).
