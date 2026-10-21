# ADR-0047: `remora_hatchery` is its own Move package, with frozen templates

- **Status:** Accepted
- **Date:** 2026-10-21
- **Deciders:** Uy (agent, goal U7)

## Context
M6 needs onchain provenance for shared remoras: `Template { author, blob_id, version, parent }` and the `Published`, `Forked` and `Deprecated` events (ADR-0012). The plan said `remora::hatchery`, a module in the Disc package.

Adding a module to the published Disc package means a package upgrade, and that has three costs:
- The upgraded package gets a new id. New calls and the new module's types and events live there, while the Disc types keep the original id. `DEPLOYMENTS` and `@remora/disc-sdk` would need a "latest package id" next to the original one.
- An upgrade risks the Disc, which holds money, for a feature that holds none.
- The Disc's `UpgradeCap` goes to a multisig before mainnet (ADR-0025), and that transfer would be tied to Hatchery changes.

## Decision
- **A separate package,** `packages/move/hatchery`, named `remora_hatchery` with module `hatchery`. Its id and its shared `Registry` go in `DEPLOYMENTS` (`hatcheryPackageId`, `hatcheryRegistryId`, ADR-0046).
- **Templates are frozen at publish.** The author, blob id and parent can never change. A new version is a new `Template` whose parent is the old one, through `publish_derived`. Lineage is checked onchain, because the parent is passed as the object itself, not as an id.
- **`fork` and `deprecate` only emit events.**
  - `fork` records that the sender hatched the template. The server puts it in the same owner PTB as the hatch's Disc issues (one signature).
  - `deprecate` checks that the sender is the author.
  - Fork counts and the deprecated flag come from the checkpoint indexer (gRPC has no event queries, ADR-0021).
- **Versioning (I6):**
  - the shared `Registry` holds the version, and every entry point checks it;
  - `migrate_registry` moves it forward only, so anyone may call it;
  - frozen templates can't migrate, so a template only has to be no newer than the package.
- **Blob ids** must be 1 to 128 bytes.
- **Publishing:**
  - testnet is published with the spike owner key, which holds this `UpgradeCap` as it does the Disc's;
  - publish `2hrYQwVdFNWr2UsT4UDC4NZjN1xv2sCznPF5ns2vk1f5`, package `0x68c7df0db31b372c0d19fdddbd04527848ad2121fcec694b2bb9ba47369de9a9`, registry `0xb3d76fff500dcd341afefec1168a95fba516ec2e71bfa0e4228d0c03d20ad3d0`;
  - the mainnet publish and the multisig `UpgradeCap` belong to Uy's mainnet pass (ADR-0024).
- **CI** runs `sui move test` for both packages.

## Consequences
- The Disc package and `@remora/disc-sdk` don't change.
- The server builds hatchery calls from `hatcheryPackageId` and the gallery indexes `remora_hatchery::hatchery::*` events.
- Docs that said `remora::hatchery` now say `remora_hatchery::hatchery`.

## Links
- ADR-0012 (Hatchery safety), ADR-0021 (gRPC only), ADR-0024 (testnet first), ADR-0025 (Disc design), ADR-0046 (Hatchery shapes)
- `packages/move/hatchery`, `spikes/disc/hatchery-publish.ts`
