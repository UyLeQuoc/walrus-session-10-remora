# ADR-0004: Address balances for every USDC flow, plus a Detect funds UI

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
Allowances draw from the funder's **address balance**. A normal coin transfer creates `Coin` objects
instead, and address balances settle periodically.

## Decision
- All USDC flows use address balances: owner funding, `disc::pay` → `balance::send_funds(payee)`, and
  merchant receipts.
- The UI has a **Detect funds** button that shows the coin vs address-balance split and moves coins in
  with one tap (`coin::send_funds`).
- "Withdraw to coin" sits under Advanced.

## Consequences
- The Oct 21 spike must confirm which Tatum call exposes the address-balance part, and how long
  settlement takes.
- Every balance in the UI shows the split.

## Links
- [remora-spec.md §12.1](../remora-spec.md#121-funds-model-address-balance-everywhere-a4)
