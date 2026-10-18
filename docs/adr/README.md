# Architecture Decision Records

**Rule:** any decision or change of direction gets an ADR here. That covers architecture, scope,
dependencies or vendors, deploy and environments, workflow, naming and security. Whoever makes the
change writes it, **agents included** (see `AGENTS.md` at the repo root).

## How to add one

1. Copy `0000-template.md` to `NNNN-short-slug.md`, using the next free number.
2. Fill in Context, Decision and Consequences, briefly. Link the docs it affects.
3. Update the docs it changes (spec, plan, features, team split) in the **same commit**.
4. Add a row to the index below.
5. **Never rewrite an accepted ADR to change the decision.** Write a new one, and set the old one's
   status to `Superseded by ADR-NNNN`.

## Index

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-track-2-only-remora.md) | Compete in Track 2 only, with Remora | Accepted |
| [0002](0002-naming.md) | Product and component names | Accepted |
| [0003](0003-spending-limits-native-allowances.md) | Spending limits on native app-bound Allowances (the Disc) + an x402 facilitator | Accepted |
| [0004](0004-address-balance-everywhere.md) | Address balances for every USDC flow, plus a Detect funds UI | Accepted |
| [0005](0005-walrus-memory-usage-rules.md) | Walrus Memory usage rules (measured by hippo) | Accepted |
| [0006](0006-reuse-hippo-and-stack.md) | Reuse hippo as disclosed prior work; adopt its stack | Accepted |
| [0007](0007-wake-receipts.md) | Wake receipts stored in Walrus Memory, intent hash anchored onchain | Accepted |
| [0008](0008-remora-creation-two-step.md) | Create a remora in two sponsored steps | Accepted |
| [0009](0009-deploy-railway-vercel-single-env.md) | Backend on Railway, frontend on Vercel, one environment: main | Accepted |
| [0010](0010-team-split-and-git-workflow.md) | Two-person split and a lightweight git workflow | Accepted |
| [0011](0011-scope-mvp-ship-set.md) | Scope: an MVP ship set of 68 features, plus a backlog | Accepted |
| [0012](0012-hatchery-template-safety.md) | Hatchery: share and duplicate remoras, with safety invariants | Accepted |
| [0013](0013-telegram-primary-channel.md) | Telegram is the primary chat channel | Accepted |
| [0014](0014-sonar-pre-action-check.md) | Sonar: defense in depth before any payment or send | Accepted |
| [0015](0015-tatum-for-all-chain-io.md) | Route all chain I/O through Tatum | Accepted |
| [0016](0016-record-decisions-as-adrs.md) | Record every decision as an ADR | Accepted |
| [0017](0017-github-repo-private-until-submission.md) | GitHub repo stays private until submission | Accepted |
| [0018](0018-bootstrap-before-window.md) | Run the U0 bootstrap before the build window | Accepted |
| [0019](0019-bootstrap-structure-decisions.md) | Structure decisions made during the bootstrap | Accepted |
| [0020](0020-allowance-spike-go.md) | Allowance spike: GO on native app-bound allowances | Accepted |
| [0021](0021-sui-grpc-only.md) | Sui chain access is gRPC only | Accepted |
| [0022](0022-no-worktrees.md) | No git worktrees: work in the main checkout on `main` | Accepted |
| [0023](0023-sui-cli-pin-and-spikes-workspace.md) | Pin Sui CLI 1.82.1 for Move, and a `spikes/*` workspace | Accepted |
| [0024](0024-testnet-first.md) | Testnet first; mainnet only when Uy says | Accepted |
| [0025](0025-disc-v1-design.md) | Disc v1 design choices | Accepted |
| [0026](0026-network-switch.md) | One deployment, both Sui networks, with a network switch in the UI | Accepted |
| [0027](0027-flex-takeover.md) | Uy's agent may take Huấn's open W1 items after finishing its own | Accepted |
| [0028](0028-w1-rails-design.md) | W1 rails design (facilitator as sponsor, queue, keys, indexer) | Accepted |
| [0029](0029-u4-web-and-e2e.md) | W1 web (U4) and the E2E harness | Accepted |
| [0030](0030-w2-memory-mode.md) | In W2, remoras' memory lives in the operator's account, by namespace | Accepted |
| [0031](0031-e4-owner-payment-and-merchants.md) | Over-limit approvals are a one-off owner payment; demo merchants accept any exact payment | Accepted |
| [0032](0032-w2-runtime-api-and-channels.md) | W2 runtime wiring, API and Telegram: who may act, and how | Accepted |
| [0033](0033-w2-api-contract.md) | The W2 API shapes are a contract in `packages/schema` | Accepted |
| [0034](0034-w2-web-live-pages.md) | W2 web pages run on the live API behind a wallet session | Accepted |
