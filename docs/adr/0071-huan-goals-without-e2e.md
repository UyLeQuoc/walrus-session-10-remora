# ADR-0071: Huấn's goals H1–H6 run without E2E while the burner wallet is empty

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Huấn

## Context
The E2E suite signs with a burner wallet. The burner has no USDC (and the testnet runs need SUI for
gas), so the money steps fail before they test anything; see the
[W3 batch 1 note](../handoffs/2026-10-23-huan-to-uy-w3-batch1-landed.md) items 2–3. Huấn's next goals
(H1–H6, `docs/goals/huan-0*.md`) are web-only and can be checked without signing anything.

## Decision
- H1–H6 do not write or run E2E. Their exit is `typecheck`, `lint`, `test` (component tests on fixtures)
  plus a manual pass at 1280 and 375 px, light and dark, with screenshots.
- Existing specs in `e2e/` stay unchanged; test ids and labels they use must not change.
- E2E comes back for the demo-ready call (Nov 6) once the burner is funded (Uy, U9 "Needs from Uy").

## Consequences
- Regressions in flows that sign or pay are caught later, at the demo-ready run.
- The post-merge-window E2E runs in team-split §5 are paused for Huấn until the burner is funded.

## Links
[team-split.md](../team-split.md) §5, [U9](../goals/uy-09-testnet-launch.md), [goals README](../goals/README.md)
