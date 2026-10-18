# ADR-0022: No git worktrees: work in the main checkout on `main`

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
`docs/team-split.md` §7 had each agent goal run in its own git worktree and branch, so up to three goals
per person could run in parallel. The owner wants something simpler: "chỉ xài hiện tại thôi không
worktree gì hết" (use only the current checkout, no worktrees at all).

## Decision
- **No worktrees and no feature branches.** Each person works in their one checkout, on `main`, and
  pushes straight to `main` after the checks (ADR-0010).
- **One goal at a time per person.** A goal runs in the main checkout and commits there.
- Branches are only for the existing PR cases: contract changes, the other lane, Move changes.

## Consequences
- Parallelism comes from the two people (and their lanes), not from many goals per person.
- Runtime isolation is per person: Uy's local server uses `CHANNELS=off` unless it's the one running
  channels; Huấn's web points at the main API.
- §7 of the team split and the goal prompts no longer mention worktrees.

## Links
- [team-split.md §7](../team-split.md#7-running-long-agent-goals-treo-goal-without-conflicts) · [ADR-0010](0010-team-split-and-git-workflow.md)
