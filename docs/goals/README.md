# Agent goals

These are paste-ready prompts for long-running agent sessions ("treo goal"). The rules for every goal are
in [team-split.md §7](../team-split.md#7-running-long-agent-goals-treo-goal-without-conflicts).

| Order | Goal | Owner | When | Depends on |
|---|---|---|---|---|
| 1 | [U0: Bootstrap the monorepo](uy-00-bootstrap.md) | Uy | **Mon Oct 20, from 07:00 Vietnam time** | — |
| 2 | [U1: Allowance spike (go/no-go)](uy-01-spike-allowance.md) | Uy | Tue Oct 21 | U0 |
| 2 | [H0: Web shell, page skeletons, E2E harness](huan-00-web-shell-e2e.md) | Huấn | Once U0 is on `main` | U0 |

## How to run one
```bash
# U0 runs in the main checkout (first goal). Later goals each get their own worktree:
git fetch origin && git worktree add ../remora-U1 -b uy/U1-spike origin/main
cd ../remora-U1 && bun install
cat docs/goals/uy-01-spike-allowance.md | pbcopy   # paste as the agent's goal/prompt
```

When a goal finishes, write the next ones here (`uy-02-…`, `huan-01-…`) following the wave plan
in [remora-plan.md](../remora-plan.md). New decisions go into [ADRs](../adr/README.md).
