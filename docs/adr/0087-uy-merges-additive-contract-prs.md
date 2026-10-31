# ADR-0087: Until submission, Uy merges additive contract PRs and his agent may take web follow-ups

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (written by Uy's agent; Uy asked it to "do it all itself")

## Context
- **Contract PRs need both approvals** ([team-split §4](../team-split.md)).
  - [ADR-0083](0083-contract-pr-17-merged-before-review.md) recorded PR #17 merged before Huấn's
    review and called it a one-off.
  - On the same day Uy asked to merge **PR #18** ([ADR-0086](0086-owner-memory-first-and-visible-duplicates.md))
    the same way.
  - So the "one-off" no longer describes what happens.
- **Huấn's review lags the work.** Both PRs only added fields with defaults, or new types and routes.
  CI passed on each before the merge.
- **The UI ask in the ADR-0086 handoff was Huấn's lane.** Uy asked his agent to do it too.
  - [ADR-0027](0027-flex-takeover.md) already lets the agent take Huấn's open items after a claim.
  - Huấn had no commit, branch or PR touching the memory inspector.
- **Nine days are left** before the submission on Nov 9.

## Decision
- **Additive contract PRs: Uy may merge once CI is green, until the submission.**
  - "Additive" means:
    - new types;
    - new fields with defaults, so older payloads still parse;
    - new routes.
  - Huấn reviews on `main`. A change he asks for goes in a new contract PR.
- **A breaking contract change still needs both approvals:**
  - a renamed or removed field;
  - a field that loses its default;
  - a changed meaning.
- **Web follow-ups that Uy's agent asked Huấn for:** when Uy asks, the agent may take them.
  - It follows ADR-0027 first: check Huấn's commits, branches and PRs, then claim the item in the
    handoff.
  - It ships to `main` with tests, and Huấn reviews through the handoff.
- **First use:**
  - PR #18 merged as `4f0180c`.
  - The inspector's "N later writes matched this" badge and the "Skipped as already known" list, with
    a web test.
- **ADR-0083's "one-off" is superseded by this.** Its status line says so.

## Consequences
- **Contract changes stop waiting on review** for the last week and a half. The review happens after
  the merge, so a mistake costs a follow-up PR instead of a blocked merge.
- **Huấn's lane can change without him.** The claim in the handoff, and his review afterwards, are what
  keep him in the loop. He should read `docs/handoffs/` before starting web work.
- **After the submission,** the two-approval rule goes back to applying to every contract PR.

## Links
- [team-split.md §4](../team-split.md) · [ADR-0027](0027-flex-takeover.md) ·
  [ADR-0083](0083-contract-pr-17-merged-before-review.md) ·
  [ADR-0086](0086-owner-memory-first-and-visible-duplicates.md) ·
  [handoff](../handoffs/2026-10-31-uy-to-huan-inspector-duplicates.md)
