# ADR-0018: Run the U0 bootstrap before the build window

- **Status:** Accepted; its claim that no feature came before the window is superseded by ADR-0075 (W1 and W2 ran on Oct 19)
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
Goal U0 (bootstrap) had a time check saying to start only after the build window opens (Oct 20, 07:00
Vietnam time), because the rules require submissions to be "completed or materially advanced during the
Hackathon Duration". On Oct 18 the owner chose to run it anyway: "làm xong là được, tại sao quan tâm đến
thời gian" (just get it done, why care about the time).

## Decision
- Run U0 on **Oct 18, 2026**. It covers:
  - the labeled hippo import;
  - removing hippo-only features;
  - making it green and scaffolding;
  - the `packages/schema` contracts;
  - CODEOWNERS, CI and the README.
- **No Remora feature is built before Oct 20.** The bootstrap is setup only: prior work plus
  structure and interfaces.
- **Be open about it:** the root README's "Built on prior work" section states the date and the scope.

## Consequences
- Git history shows setup commits dated Oct 18. The disclosure in the README is the mitigation.
- Every feature commit (W1 onwards, starting with U1) is dated inside the window.
- `docs/goals/uy-00-bootstrap.md` keeps its time check for reference, but this ADR supersedes it.

## Links
- [README.md](../../README.md#built-on-prior-work) · [goals/uy-00-bootstrap.md](../goals/uy-00-bootstrap.md) · [event-rules.md §5](../event-rules.md#5-submissions)
