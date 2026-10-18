# ADR-0003: Spending limits on native app-bound Allowances (the Disc) + an x402 facilitator

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
Sui's native `sui::allowance` went live on mainnet on Oct 9, 2026 (protocol v138). **App-bound**
allowances route every spend through an app's Move module. No agent product uses them yet: Agent Pass
exists only on slides, and Agent Payments is testnet-only. Sui x402 facilitators are community-run.

## Decision
- Build the **Disc** as the app module (`remora::disc`, app type `DISC`) of an app-bound allowance.
  - Sui enforces budget, window, expiry and revocation.
  - The Disc adds the payee allowlist, per-payment cap, pause, rotation and `Paid` events.
- Ship a **Tatum-backed x402 facilitator** for `sui:mainnet`.
- **Fallback:** if the Oct 21 spike fails, a `Coin` escrow with the same Disc policy, labeled as a
  fallback.

## Consequences
- Budget changes need revoke + reissue, because there's no in-place update.
- The native module emits no events, so we emit `Paid` and index it through Tatum.
- Holders of `SettingsPermit<DISC>` can rotate any Disc-bound spender, so permit minting is guarded by an
  owner check.

## Links
- [tech-reference.md §3.1](../tech-reference.md#31-native-allowances-suiallowance-mainnet-since-oct-9-protocol-v138) · [remora-spec.md §6](../remora-spec.md#6-disc-onchain-spending-limits)
