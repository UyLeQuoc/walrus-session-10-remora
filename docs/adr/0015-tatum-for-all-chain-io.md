# ADR-0015: Route all chain I/O through Tatum

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
Judging weighs a "successful Tatum Sui RPC integration" as part of technical quality (30%). Sui has
deprecated JSON-RPC in favor of gRPC.

## Decision
- Every Sui read and write goes through Tatum, behind one typed client in `packages/chain`:
  - the gRPC checkpoint stream for triggers;
  - JSON-RPC dry-run and execute for payments;
  - `getObject` and `queryEvents` for state.
- The Data API provides USD rates.

## Consequences
- The README lists every Tatum call.
- A Tatum outage is a single point of failure, handled with retries and idempotent settlement.

## Links
- [remora-spec.md §11](../remora-spec.md#11-tatum-usage)
