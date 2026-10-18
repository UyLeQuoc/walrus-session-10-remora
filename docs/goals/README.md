# Agent goals

These are paste-ready prompts for long-running agent sessions ("treo goal"). The rules for every goal are
in [team-split.md §7](../team-split.md#7-running-long-agent-goals-treo-goal-without-conflicts).

| Order | Goal | Owner | When | Depends on |
|---|---|---|---|---|
| 1 | [U0: Bootstrap the monorepo](uy-00-bootstrap.md) ([prompt](uy-00-bootstrap.prompt.txt)) | Uy | ✅ **Done Oct 18** ([ADR-0018](../adr/0018-bootstrap-before-window.md)) | — |
| 2 | [U1: Allowance spike (go/no-go)](uy-01-spike-allowance.md) ([prompt](uy-01-spike-allowance.prompt.txt)) | Uy | ✅ **Done Oct 19: GO** ([ADR-0020](../adr/0020-allowance-spike-go.md); mainnet moved to the mainnet pass, [ADR-0024](../adr/0024-testnet-first.md)) | U0 ✅ |
| 2 | [H0: Web shell, page skeletons, E2E harness](huan-00-web-shell-e2e.md) ([prompt](huan-00-web-shell-e2e.prompt.txt)) | Huấn | From Mon Oct 20 (inside the window) | U0 ✅ |
| 3 | [U2: Real Disc + disc-sdk, testnet](uy-02-disc-testnet.md) ([prompt](uy-02-disc-testnet.prompt.txt)) | Uy | ✅ **Done Oct 19** ([notes](../spikes/2026-10-19-disc-testnet.md), PR #2 Move, PR #3 contract) | U1 ✅ |
| 4 | [U3: All W1 rails end to end, network-switchable](uy-03-w1-rails.md) ([prompt](uy-03-w1-rails.prompt.txt)) | Uy | Next | U2 ✅ |

## How to run one
```bash
# Every goal runs in your main checkout on main (no worktrees, ADR-0022):
git pull --rebase origin main && bun install
pbcopy < docs/goals/uy-03-w1-rails.prompt.txt   # paste as the agent's goal (<4000 chars)
```

Each goal has two files:

- **`*.prompt.txt`:** the short prompt you paste. It's under 4,000 characters and points to the full
  spec.
- **`*.md`:** the full spec, steps and done-criteria. The agent reads it as its source of truth.

When a goal finishes, write the next ones here (`uy-02-…`, `huan-01-…`) following the wave plan
in [remora-plan.md](../remora-plan.md). New decisions go into [ADRs](../adr/README.md).
