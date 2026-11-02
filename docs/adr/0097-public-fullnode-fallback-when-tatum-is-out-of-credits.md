# ADR-0097: When Tatum answers 402, Sui calls go to the public fullnode's gRPC and the price to a public API

- **Status:** Accepted
- **Date:** 2026-11-02
- **Deciders:** Uy (built by Uy's agent, after Tatum's advice to another team in the hackathon Discord)

## Context
- **Our Tatum keys are out of credits again.** On Nov 2, the testnet and mainnet keys (one account)
  both answered `402` to every gRPC call and stream. The Data API did the same.
  - It is the second time, after Oct 23 ([ADR-0058](0058-tatum-credit-budget.md)).
  - Health showed `tatum (testnet)` down, and the budget route had failed 99 times in its error list.
  - The gas station and the playground funder couldn't read balances either, so the app a judge
    opens was broken.
- **Tatum's advice.** Another team asked in the hackathon Discord what to do with a spent free plan
  until the Nov 10 deadline. A Tatum team member answered:
  - judges won't penalize a team for hitting a free tier's limits;
  - the team should route through public RPC and price endpoints for now;
  - and say so clearly in the README and the submission.
  - They also offered a discount code for a monthly plan by DM.
- **The public fullnode serves what we need.** `fullnode.<network>.sui.io:443` answers native gRPC
  (grpc-js, the same transport as Tatum), streams included. A probe on Nov 2 read the tip, an object
  and a balance, and got 24 checkpoint frames in 6 s. It needs no key.
- **Every server-side Sui client comes from `createTatumSuiClient`:** the API, the runtime, the
  facilitator and gas station, the merchants and the e2e. So the change fits in one place.

## Decision
- **Tatum stays the primary. A 402 sends calls to the public fullnode for a cool-down.**
  - `FallbackTransport` (`packages/chain/src/fallback.ts`) wraps the paced Tatum transport.
  - A unary call that Tatum refuses with 402 is sent again to the fallback. The gateway refused it,
    so nothing ran, and even `ExecuteTransaction` is safe to resend.
  - Calls go straight to the fallback for 10 minutes, then Tatum gets the next call again. A key
    that was topped up or replaced takes over within 10 minutes, with no restart.
  - A stream's 402 arrives after it opens. Its owner (the watcher, the indexer) reconnects after
    its backoff, and that open goes to the fallback.
  - Every other error is Tatum's answer and passes through unchanged.
- **The fallback's URL.**
  - `SUI_GRPC_FALLBACK` (mainnet) and `SUI_GRPC_FALLBACK_TESTNET` take a gRPC URL, or `off`.
  - Unset, it is the public fullnode (`publicGrpcUrl`).
  - The fallback is paced like Tatum (3 calls a second), and its calls don't count as Tatum usage.
- **The switch is visible.**
  - The first switch logs `tatum.fallback { network, to, reason }`.
  - Health's `tatum (<network>)` item turns `degraded`. It says since when calls go to the public
    fullnode and how many went, and keeps the 402 fix (top up the plan, or set a new key). The public
    `/status` shows the item as degraded.
- **The SUI price falls back too.** When Tatum's Data API can't answer, the cost card's gas price
  comes from CoinGecko's public simple-price API (no key). If that fails too, the error is Tatum's.
- **The README and the submission say it.** Our Tatum free-plan credits ran out during development,
  so the server routes through the public fullnode while Tatum answers 402.

## Consequences
- **The app keeps working while the plan is spent.** That covers payments, budgets, the gas station,
  the playground, Sentinel's stream and verification.
- **Tatum is still the integration.** With credits, every call goes through Tatum as before
  ([ADR-0015](0015-tatum-for-all-chain-io.md)). The call list in the README doesn't change.
- **The public fullnode has its own rate limits,** which Mysten doesn't promise. At 3 calls a second
  per process, our load stays small.
- **A 402 costs one wasted call per 10 minutes per process,** when Tatum is tried again.
- **Uy may still buy a plan,** with the discount Tatum offered. Then the fallback stays idle.

## Links
- [ADR-0015](0015-tatum-for-all-chain-io.md) · [ADR-0021](0021-sui-grpc-only.md) ·
  [ADR-0058](0058-tatum-credit-budget.md) · [ADR-0080](0080-tatum-usage-in-health-and-no-resubscribe-backfill.md)
- `packages/chain/src/fallback.ts`, `packages/chain/src/tatum.ts`, `apps/server/src/ops/health.ts`,
  `apps/server/src/money/rates.ts`, [README "How Remora uses Tatum"](../../README.md#how-remora-uses-tatum)
