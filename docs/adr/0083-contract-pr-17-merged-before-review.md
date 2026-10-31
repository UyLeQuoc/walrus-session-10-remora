# ADR-0083: Contract PR #17 merged before Huấn's review

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (written by Uy's agent)

## Context
- **The contract rule.** A contract PR needs both approvals before it merges
  ([team-split §4](../team-split.md)).
- **PR #17 had passed CI but had no review on GitHub.**
  - It moves Huấn's H2–H6 shapes into `packages/schema` unchanged, with F15's fact types and a fixture
    for each.
  - It adds three lines to `routes.tsx`: `status`, `reef` and `p/:token`.
  - CI passed on its head, `5a6c5d4`.
- **Uy asked to merge it on Oct 31.** U9's deploy and Huấn's pages both need the shapes on `main`.

## Decision
- **Merge #17 now** with a merge commit (`e7001fe`), as with earlier contract PRs.
- **Huấn reviews after the merge.**
  - He can ask for a change in a new contract PR.
  - Or he can revert it on `main`.
- **This is a one-off.** The two-approval rule for contract PRs stays.

## Consequences
- **Huấn's pages build against `@remora/schema`** and route to `/status`, `/reef` and `/p/:token` on
  `main`. They reach real data at the U9 deploy.
- **Low risk.** The change only adds new types and three routes, and the shapes are the ones Huấn wrote.
- **What changes is the review step:** Huấn now reviews code that is already on `main`, not a pending
  PR.

## Links
- [ADR-0076](0076-u9-backend-for-huan-pages.md) ·
  [handoff](../handoffs/2026-10-31-uy-to-huan-u9-landed.md) · PR #17
