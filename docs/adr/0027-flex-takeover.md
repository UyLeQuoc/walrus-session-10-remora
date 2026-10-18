# ADR-0027: Uy's agent may take Huấn's open W1 items after finishing its own

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Uy Le

## Context
Uy wants his agent to keep going after U3 by taking Huấn's W1 work ("gom lại của Huấn cho tôi làm luôn
nếu tôi xong, đưa goal chung"). Team-split §2 gives `apps/web`, `e2e/` and the copy to Huấn, and
says infra and UI are a flex pool. Two agents editing the same web folders would conflict.

## Decision
- **After U3 is done,** Uy's agent runs goal **U4** with Huấn's open W1 items: H0 (shell, page
  skeletons, copy v1, E2E harness), A1·ui, A4·ui, A9·ui and the error copy.
- **Claim before editing.** First pull `main` and check Huấn's commits and handoffs. Skip anything he
  has started. Push a claim note to `docs/handoffs/` listing exactly what Uy's agent takes. Huấn
  skips claimed items.
- The ownership in CODEOWNERS doesn't change. The web stays Huấn's lane, and he reviews what U4 ships
  through a handoff.

## Consequences
- U4's allowed paths include `apps/web/**` (not `features/lab`, which is already Uy's), `e2e/**`,
  `apps/server/src/copy/**` and `docs/ux/**`, `docs/e2e/**`, limited to the claimed items.
- Huấn should glance at `docs/handoffs/` before starting a goal.

## Links
- [team-split.md §2, §7](../team-split.md) · [ADR-0010](0010-team-split-and-git-workflow.md) · [ADR-0022](0022-no-worktrees.md)
