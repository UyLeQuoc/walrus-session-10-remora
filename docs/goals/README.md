# Agent goals

These are paste-ready prompts for long-running agent sessions ("treo goal"). The rules for every goal are
in [team-split.md §7](../team-split.md#7-running-long-agent-goals-treo-goal-without-conflicts).

| Order | Goal | Owner | When | Depends on |
|---|---|---|---|---|
| 1 | [U0: Bootstrap the monorepo](uy-00-bootstrap.md) ([prompt](uy-00-bootstrap.prompt.txt)) | Uy | ✅ **Done Oct 18** ([ADR-0018](../adr/0018-bootstrap-before-window.md)) | — |
| 2 | [U1: Allowance spike (go/no-go)](uy-01-spike-allowance.md) ([prompt](uy-01-spike-allowance.prompt.txt)) | Uy | ✅ **Done Oct 19: GO** ([ADR-0020](../adr/0020-allowance-spike-go.md); mainnet moved to the mainnet pass, [ADR-0024](../adr/0024-testnet-first.md)) | U0 ✅ |
| 2 | [H0: Web shell, page skeletons, E2E harness](huan-00-web-shell-e2e.md) ([prompt](huan-00-web-shell-e2e.prompt.txt)) | Huấn | From Mon Oct 20 (inside the window) | U0 ✅ |
| 3 | [U2: Real Disc + disc-sdk, testnet](uy-02-disc-testnet.md) ([prompt](uy-02-disc-testnet.prompt.txt)) | Uy | ✅ **Done Oct 19** ([notes](../spikes/2026-10-19-disc-testnet.md), PR #2 Move, PR #3 contract) | U1 ✅ |
| 4 | [U3: All W1 rails end to end, network-switchable](uy-03-w1-rails.md) ([prompt](uy-03-w1-rails.prompt.txt)) | Uy | ✅ **Done Oct 19: W1 exit on testnet** ([notes](../spikes/2026-10-19-w1-exit.md)) | U2 ✅ |
| 5 | [U4: Take Huấn's open W1 items (web, funds UI, network switch, E2E)](uy-04-w1-ui-takeover.md) ([prompt](uy-04-w1-ui-takeover.prompt.txt)) | Uy's agent ([ADR-0027](../adr/0027-flex-takeover.md)) | ✅ **Done Oct 19** ([handoff](../handoffs/2026-10-19-uy-to-huan-u4-landed.md)) | U3 ✅ |
| 6 | [U5: W2 core product end to end (both lanes)](uy-05-w2-core-product.md) ([prompt](uy-05-w2-core-product.prompt.txt)) | Uy's agent (+ Huấn's W2 UI, ADR-0027) | ✅ Done (W2 exit on testnet; model path and Telegram unverified) | U3 ✅, U4 ✅ |
| 7 | [U6: the Grok-bots shape (chat, rooms, model each, teams from Markdown)](uy-06-grok-bots-shape.md) ([prompt](uy-06-grok-bots-shape.prompt.txt)) | Uy's agent (+ claimed UI, ADR-0027) | ✅ **Done Oct 21: U6 exit on testnet, model path verified** ([notes](../spikes/2026-10-21-u6-exit.md), [handoff](../handoffs/2026-10-21-uy-to-huan-u6-landed.md); Telegram unverified) | U5 ✅ |
| 8 | [U7: Hatchery on Walrus, Proof of Learning, memory controls](uy-07-hatchery-proof-of-learning.md) ([prompt](uy-07-hatchery-proof-of-learning.prompt.txt)) | Uy's agent (+ UI items Huấn hasn't started, ADR-0027) | ✅ **Done Oct 22: U7 exit on testnet** ([notes](../spikes/2026-10-22-u7-exit.md), [handoff](../handoffs/2026-10-22-uy-to-huan-u7-landed.md); Telegram unverified) | U6 ✅ |
| 9 | [U8: launch readiness (playground, health + diagnose, threat model, README)](uy-08-launch-readiness.md) ([prompt](uy-08-launch-readiness.prompt.txt)) | Uy's agent (+ /playground if Huấn hasn't started it, ADR-0027) | ✅ **Done Oct 22: U8 exit on testnet** ([notes](../spikes/2026-10-22-u8-exit.md), [handoff](../handoffs/2026-10-22-uy-to-huan-u8-landed.md)). The full suite is 43/43; it was 42/43 during the MemWal relayer's outage ([ADR-0055](../adr/0055-memory-failures-in-health.md)). Telegram unverified | U7 ✅ |

## How to run one
```bash
# Every goal runs in your main checkout on main (no worktrees, ADR-0022):
git pull --rebase origin main && bun install
pbcopy < docs/goals/uy-08-launch-readiness.prompt.txt   # paste as the agent's goal (<4000 chars)
```

Each goal has two files:

- **`*.prompt.txt`:** the short prompt you paste. It's under 4,000 characters and points to the full
  spec.
- **`*.md`:** the full spec, steps and done-criteria. The agent reads it as its source of truth.

When a goal finishes, write the next ones here (`uy-02-…`, `huan-01-…`) following the wave plan
in [remora-plan.md](../remora-plan.md). New decisions go into [ADRs](../adr/README.md).
