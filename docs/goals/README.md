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
| 10 | [U9: the testnet launch (public URL, /status, Huấn's W3 queue, D5 handoff, red-team evals; license done: MIT, ADR-0068)](uy-09-testnet-launch.md) ([prompt](uy-09-testnet-launch.prompt.txt)) | Uy's agent + Uy at every deploy step | **In progress Oct 31:** Phases 0 (contract PR #17), A, B and C and the launch docs are on `main` ([ADR-0076](../adr/0076-u9-backend-for-huan-pages.md)–[0081](../adr/0081-launch-story.md), [notes](../spikes/2026-10-31-u9-backend-and-launch-docs.md)); Phase D (deploy) and F (exit) wait on Uy | U8 ✅ ([ADR-0059](../adr/0059-launch-on-testnet.md)) |
| 11 | [U10: the mainnet pass (mainnet money, owned memory, Walrus Sites)](uy-10-mainnet-pass.md) ([prompt](uy-10-mainnet-pass.prompt.txt)) | Uy's agent + Uy at every mainnet transaction | When Uy calls it | U9 |
| 12 | [U11: Receipts (Track 1) and Kitty (Track 3) on Remora's rails](uy-11-receipts-and-kitty.md) ([prompt](uy-11-receipts-and-kitty.prompt.txt)) | Uy's agent, unattended overnight | ✅ **Done Oct 25: both exits passed on testnet** ([notes](../spikes/2026-10-25-u11-exit.md)); then the web with wallets ([ADR-0064](../adr/0064-receipts-kitty-web-with-wallets.md)) and the split into `total-recall-receipts` and `total-recall-kitty` ([ADR-0065](../adr/0065-split-receipts-and-kitty-repos.md)) | U8 ✅ |
| 13 | [U12: agents use Remora, Receipts and Kitty through MCP (a UI and an MCP server in each)](uy-12-agents-mcp.md) ([prompt](uy-12-agents-mcp.prompt.txt)) | Uy's agent (+ the Connections page if Huấn hasn't started it, ADR-0027) | ✅ **Done Oct 25: U12 exit on testnet in all three repos** ([notes](../spikes/2026-10-25-u12-exit.md), [handoff](../handoffs/2026-10-25-uy-to-huan-u12-landed.md)); real wallets and remote Receipts/Kitty MCP clients unverified | U11 |
| 14 | [U13: Remora's web in openbot's UI (the whole UI, ported under PolyForm Noncommercial)](uy-13-openbot-ui.md) ([prompt](uy-13-openbot-ui.prompt.txt)) | Uy's agent (claims `apps/web`, [claim](../handoffs/2026-10-27-uy-to-huan-u13-claim.md)) | ✅ **Done Oct 27: the whole web in openbot's UI** (PR #15, [notes](../spikes/2026-10-27-u13-exit.md), [handoff](../handoffs/2026-10-27-uy-to-huan-u13-landed.md), [ADR-0069](../adr/0069-openbot-ui-ported-under-polyform.md), [ADR-0070](../adr/0070-u13-openbot-ui-implementation.md)); U12's MCP recall step waits on the memory relayer | U12 ✅ |
| 15 | [H1: review U13, decide ADR-0041, copy pass](huan-01-u13-review.md) | Huấn | ✅ **Done Oct 29** | U13 ✅ |
| 16 | [H2: `/status` on the public endpoint (N20·ui)](huan-02-status-route.md) | Huấn | ✅ **Done Oct 29 (web side)**; routes and endpoints on `main` ([answers](../handoffs/2026-10-31-uy-to-huan-h2-h6-answers.md), PR #17); live at the U9 deploy | U9 Phase 0 |
| 17 | [H3: cost card (N15·ui)](huan-03-cost-card.md) | Huấn | ✅ **Done Oct 29 (web side)**; routes and endpoints on `main` ([answers](../handoffs/2026-10-31-uy-to-huan-h2-h6-answers.md), PR #17); live at the U9 deploy | U9 Phase A |
| 18 | [H4: Reef directory `/reef` (E7·ui)](huan-04-reef-directory.md) | Huấn | ✅ **Done Oct 29 (web side)**; routes and endpoints on `main` ([answers](../handoffs/2026-10-31-uy-to-huan-h2-h6-answers.md), PR #17); live at the U9 deploy | U9 Phase A |
| 19 | [H5: public proof links (G6·ui)](huan-05-public-proof-links.md) | Huấn | ✅ **Done Oct 29 (web side)**; routes and endpoints on `main` ([answers](../handoffs/2026-10-31-uy-to-huan-h2-h6-answers.md), PR #17); live at the U9 deploy | U9 Phase A |
| 20 | [H6: account export and exit (A8·ui), if time allows](huan-06-account-exit.md) | Huấn | ✅ **Done Oct 29 (web side)**; routes and endpoints on `main` ([answers](../handoffs/2026-10-31-uy-to-huan-h2-h6-answers.md), PR #17); live at the U9 deploy | U9 Phase A (A8) |
| 21 | F15: memory facts and admission, after Dewee (asked directly, no goal file) | Uy's agent | ✅ **Done Oct 31** ([ADR-0074](../adr/0074-memory-facts-and-admission.md), [notes](../spikes/2026-10-31-f15-facts-admission.md), [handoff](../handoffs/2026-10-31-uy-to-huan-f15-facts.md)); found and fixed track-record updates being swallowed by dedupe; the UI is Huấn's | U13 ✅ |
| 22 | [U14: a visual-first web (fewer words, data at a glance, three review rounds), then the video again](uy-14-visual-ui-pass.md) ([prompt](uy-14-visual-ui-pass.prompt.txt)) | Uy's agent (claims the look of `apps/web`, [claim](../handoffs/2026-11-04-uy-to-huan-u14-claim.md)) | ✅ **Done Nov 4:** five review rounds, blockers and majors from 17/55 to 0 open, words −40.5% ([notes](../spikes/2026-11-04-u14-exit.md), [review](../ux/review/README.md), [handoff](../handoffs/2026-11-04-uy-to-huan-u14-landed.md), [ADR-0103](../adr/0103-visual-first-ui-pass.md), [ADR-0104](../adr/0104-visual-first-result.md)); PR #19; the deploy waits for Uy | U9 deploy ✅ |
| 23 | U15: examples you can try, a curated gallery, and the video's "And more" (asked directly, no goal file) | Uy's agent ([claim](../handoffs/2026-11-04-uy-to-huan-examples-claim.md)) | ✅ **Done Nov 4:** 16 examples verified on testnet, six templates on Walrus, video 178 s ([notes](../spikes/2026-11-04-examples-exit.md), [ADR-0105](../adr/0105-examples-you-can-try.md)); PR #20 | U14 ✅ |
| 24 | [U16: the wow pass: more things to buy, a third kind, live proof in the video, the landing's range](uy-16-wow-pass.md) ([prompt](uy-16-wow-pass.prompt.txt)) | Uy's agent, every part ([ADR-0107](../adr/0107-u16-without-handoffs.md)) | ✅ **Done Nov 4** ([exit](../spikes/2026-11-04-u16-exit.md); [ADR-0106](../adr/0106-wow-pass-more-uses.md) to [ADR-0109](../adr/0109-pay-only-at-listed-address.md)) | U15 ✅ |
| 25 | [U17: Remora at scale: an open Reef, crews, more doors, numbers under load, then the deploy](uy-17-scale.md) ([prompt](uy-17-scale.prompt.txt)) | Uy's agent, every part ([ADR-0107](../adr/0107-u16-without-handoffs.md)'s way) | ✅ **Done Nov 5** ([exit](../spikes/2026-11-05-u17-exit.md); [ADR-0111](../adr/0111-scale-pass.md) to [ADR-0117](../adr/0117-image-carries-load-runs.md)); deployed to getremora.vercel.app | U16 ✅ |

H1–H6 run without E2E while the burner wallet is empty ([ADR-0071](../adr/0071-huan-goals-without-e2e.md)).

## How to run one
```bash
# Every goal runs in your main checkout on main (no worktrees, ADR-0022):
git pull --rebase origin main && bun install
pbcopy < docs/goals/uy-14-visual-ui-pass.prompt.txt   # next (<4000 chars each)
```

Each goal has two files:

- **`*.prompt.txt`:** the short prompt you paste. It's under 4,000 characters and points to the full
  spec.
- **`*.md`:** the full spec, steps and done-criteria. The agent reads it as its source of truth.

When a goal finishes, write the next ones here (`uy-02-…`, `huan-01-…`) following the wave plan
in [remora-plan.md](../remora-plan.md). New decisions go into [ADRs](../adr/README.md).
