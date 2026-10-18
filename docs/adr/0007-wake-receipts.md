# ADR-0007: Wake receipts stored in Walrus Memory, intent hash anchored onchain

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
Agents need a verifiable activity log. The full receipt can't go inside the payment transaction, because
the receipt contains that transaction's digest.

## Decision
- A Wake is JSON with an `intent` part and a `result` part, stored in the `receipts` namespace.
- `sha256(intent)` is computed **before** paying and passed to `disc::pay`, so it lands in
  `Paid.intent`.
- The full Wake is written after settlement.
- `remora verify` checks the intent hash, the balance change and the memory timestamps.

## Consequences
- Non-payment Wakes have no onchain anchor until Merkle batching (G4, backlog).
- The owner can decrypt Wakes in the browser (hippo's `wallet-read`).

## Links
- [remora-spec.md §9](../remora-spec.md#9-wake-receipts)
