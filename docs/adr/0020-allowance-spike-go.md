# ADR-0020: Allowance spike: GO on native app-bound allowances

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
ADR-0003 chose native app-bound `sui::allowance` for the Disc, with a `Coin` escrow as the fallback if
the spike failed. ADR-0004 put every flow on address balances. U1 had to prove both through Tatum
before E1 builds on them. The evidence is in [docs/spikes/2026-10-21-allowance.md](../spikes/2026-10-21-allowance.md).

The **testnet run went through Tatum gRPC** (protocol 139), digests recorded:

- coin → address balance: readable as soon as the transaction is final;
- publish of a stub `disc`;
- owner `propose_for_app` → `disc::issue` in one PTB;
- a 0-SUI spender paying through `tx.withdrawal({ from: 'allowance' })` → `disc::pay` with sponsored gas;
- revoke.

All seven negative cases fail before execution, with no gas charged: over the per-payment cap, payee not
allowed, over the lifetime cap, before start, after expiry, wrong spender, and after revoke.

Mainnet (protocol 138) has the same feature flags, and the same flow is scripted. Its run waits for
funding and Uy's OK per transaction.

## Decision
**GO: keep native app-bound allowances. No `Coin` escrow fallback.** Specifics for E1 and the runtime:

- **Client calls.** All of these go through `@remora/chain` (Tatum gRPC, `PacedTransport`):
  - funds split: `StateService.GetBalance` (`address_balance` / `coin_balance`);
  - deposit: `coin::send_funds`;
  - issue: `0x2::allowance::propose_for_app<Balance<C>, DISC>` then `remora::disc::issue`, one owner PTB;
  - spend: `tx.withdrawal({ from: 'allowance', allowance, funder, amount, type })` → `remora::disc::pay`;
  - revoke: `remora::disc::revoke`.
- **The Disc is linked to its allowance by `(funder, name)`, not by allowance ID.**
  `allowance::issue` returns no ID. `disc::issue` records the key in a shared registry and refuses
  duplicates. The per-allowance `Disc` object (payees, cap, pause) stores the key, and `pay` checks the
  allowance's settings against it.
- **The gas sponsor is never a funder.** The SDK pays gas from the gas owner's address balance when it
  has one (`enable_address_balance_gas_payments`), so a sponsor that's also a funder spends its own
  allowance budget on gas.
- **Rate-limit Tatum on the client.** At least 3 unary calls/s on the current plan. Retry 429s (safe even
  for execute), and never blindly retry other execute errors.
- **The x402 `exact` verify works unchanged.** The payee's +amount shows up in `balanceChanges` for
  `send_funds` into an address balance.
- Toolchain: Sui CLI ≥ 1.81 (pinned 1.82.1, ADR-0023).

## Consequences
- remora-spec §6 (`Disc` key instead of `allowance: ID`, plus the registry), §12.1 (spike result) and
  §12.3 (sponsor separate from funders) are updated in this commit, along with tech-reference §3.
- The "settling" UI state from §12.1 stays for robustness. On testnet the deposit was readable as soon
  as the transaction was final.
- E1 builds the real Disc from the stub (PR #1): pause, `set_payees`, rotate, `Paid` events with the
  intent hash.
- **Before E1's mainnet publish,** run `spikes/allowance/flow.ts mainnet` with ≤ 0.10 USDC per
  transaction, after Uy's OK on each one. If it diverges from testnet, write a superseding ADR.

## Links
- [ADR-0003](0003-spending-limits-native-allowances.md) · [ADR-0004](0004-address-balance-everywhere.md) · [ADR-0015](0015-tatum-for-all-chain-io.md) · [ADR-0021](0021-sui-grpc-only.md) · [ADR-0023](0023-sui-cli-pin-and-spikes-workspace.md)
- [Spike notes](../spikes/2026-10-21-allowance.md) · PR #1 (stub `disc`)
