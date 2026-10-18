# ADR-0023: Pin Sui CLI 1.82.1 for Move, and a `spikes/*` workspace

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
U1 found that Sui CLI 1.74's bundled framework has no `sui::allowance` (`unbound module`), while the
fullnodes behind Tatum run 1.81.1 (mainnet) and 1.82.1 (testnet). The spike scripts also need workspace
packages (`@remora/chain`, `@mysten/sui`), and bun doesn't hoist dependencies to the root.

## Decision
- **Move builds use Sui CLI `testnet-v1.82.1`**: locally through `suiup install sui@testnet`, and in
  CI as a pinned release download in the `move` job. Bump it on purpose, with a note here or in a newer
  ADR.
- **`spikes/*` is a bun workspace** for throwaway spike code. A spike has a `typecheck` script and no
  `test` script, and a spike package is deleted when its decision is recorded.

## Consequences
- Every Move package needs CLI ≥ 1.81 to compile against `sui::allowance`.
- Spike code is linted and typechecked in CI like the rest.

## Links
- [docs/spikes/2026-10-21-allowance.md](../spikes/2026-10-21-allowance.md) · [ADR-0021](0021-sui-grpc-only.md)
