# ADR-0010: Two-person split and a lightweight git workflow

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le, Huấn

## Context
Two people (and their long-running agent goals) work in parallel. The owner wants one `main` and few
PRs.

## Decision
- **Uy Le:** Sui, Walrus Memory, Move, backend, plus deploys, the video and the submission.
- **Huấn:** UI/UX and E2E.
- Infra and UI are a flex pool either person can claim.
- **Ownership is by directory.** Interfaces are frozen contracts in `packages/schema`.
- **Commit straight to `main`** within your own paths, after local checks. PRs only for contract changes,
  the other person's lane, and Move changes.

## Consequences
- Conflicts are prevented by ownership + contracts, not by review gates.
- CODEOWNERS is an ownership map; it only enforces anything on PRs.

## Links
- [team-split.md](../team-split.md)
