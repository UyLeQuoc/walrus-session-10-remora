# ADR-0025: Disc v1 design choices

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Uy Le

## Context
U2 built the real `remora::disc` from spec §6 and the U1 findings (ADR-0020), plus `@remora/disc-sdk`.
A few choices go beyond the spec or settle questions it left open.

## Decision
- **Link:** a `Registry` table maps `DiscKey { owner, name }` → Disc ID. `pay`, `rotate` and `revoke`
  check that the allowance's `(funder, name)` matches the Disc (`EWrongDisc`). Revoke + reissue can
  reuse the name in the same PTB.
- **Events for the indexer:** `DiscIssued`, `Paid`, `DiscUpdated`, `SpenderRotated` and `DiscRevoked`.
  The allowance module emits none, and gRPC has no event queries, so the checkpoint indexer builds
  history from these.
- **Owner controls:** `set_per_payment_cap` exists in addition to the spec's `set_payees` and `pause`.
  Budget, window and expiry changes stay revoke + reissue (the native allowance can't be edited in
  place).
- **Upgrades (I6):** every object has a `version`, checked on every entry point. `migrate_registry` and
  `migrate_disc` only move forward to the package's `VERSION`, so anyone may call them, and there's no
  admin cap. Public functions take `&mut TxContext`.
- **`UpgradeCap`:** on testnet the spike owner key holds it. **Before the mainnet publish, it goes to a
  multisig** (Uy + a backup key), as part of Uy's mainnet pass (ADR-0024).
- **`@remora/disc-sdk` is transport-agnostic.** Readers take the `client.core` shape, so the same code
  runs on Tatum gRPC in Node (`@remora/chain`) and on gRPC-web in the browser, where owners sign
  issue, pause and revoke. It doesn't depend on `@remora/chain`.
- **Error codes:** Disc failures map onto `@remora/schema` `ERROR_CODES` through `toDiscError`. The new
  `disc.not_owner`, `disc.not_spender`, `disc.wrong_disc`, `disc.exists`, `disc.bad_intent` and
  `disc.outdated` codes go through contract PR #3.

## Consequences
- remora-spec §6 is updated to this shape. Huấn gets a handoff for the copy of the new error codes.
- E3 (facilitator) and D8 (sponsor) build on `buildPay` and `toDiscError`. See the notes in
  [docs/spikes/2026-10-19-disc-testnet.md](../spikes/2026-10-19-disc-testnet.md).
- The mainnet pass adds two things: the multisig `UpgradeCap` transfer and the mainnet `DEPLOYMENTS`
  IDs.

## Links
- [ADR-0020](0020-allowance-spike-go.md) · [ADR-0024](0024-testnet-first.md) · PR #2 (Move) · PR #3 (contract)
