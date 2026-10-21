# packages/move/hatchery

The `remora_hatchery` Move package (M6, [ADR-0047](../../../docs/adr/0047-hatchery-move-package.md)): provenance for shared remoras. A `Template` is frozen at publish (author, Walrus blob id, parent) and emits `Published`. Hatching records `Forked` in the same transaction as the hatcher's Disc issues. Only the author can record `Deprecated`. The shared `Registry` is the version gate (I6).

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** M6
- **Status:** v1, published on testnet (`packages/schema` DEPLOYMENTS). `sui move test` runs 11 tests.
- **Publish (testnet only):** `bun --env-file=.env spikes/disc/hatchery-publish.ts`. Mainnet is Uy's call (ADR-0024).
