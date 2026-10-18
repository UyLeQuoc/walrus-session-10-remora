# ADR-0030: In W2, remoras' memory lives in the operator's account, by namespace

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Uy Le

## Context
The spec (§3) gives every remora its own Walrus Memory delegate key on the **owner's** account, added with a relayer-sponsored `add_delegate_key`. That's a mainnet transaction per remora, signed by the owner. Under ADR-0024 we build on testnet first and only touch mainnet when Uy calls the pass. Memory itself is mainnet-only (ADR-0026). Uy's operator account (`0x183c…7641`, owner `0x3d4f…ea24`) has the server's delegate registered (sponsored `add_delegate_key` `4eaLKmDdAR3Wz47Fqd3XKsGv3oUxc9Cbf4chyC4gTW24`, approved by Uy on Oct 19).

## Decision
- **During W2, every remora reads and writes memory through the server's delegate on the operator account**, in namespaces scoped to its owner and to itself:
  - `owner:<ownerAddress>:me` is shared by all of that owner's remoras;
  - `remora:<remoraId>:<ns>` holds its own, where `ns` is `sources`, `rules`, `episodes`, `feedback`, `budget`, `handoffs` or `receipts`.

  This is hippo's guest mode, generalized.
- **Owned mode** (a delegate per remora on the owner's own account, spec §3 B3 step 1) ships with the mainnet pass. The namespaces keep the same names, so moving over is a scope change, not a data migration. Old memories stay readable via `alsoRead`, as hippo already does.
- Writes go through `@remora/memory`'s port, which redacts credentials before every write (I5/F11a) and records rows in `memory_index`.

## Consequences
- The "honest boundary" (spec §3) still holds and is stated in the UI: namespaces are a convention, not a security boundary. Money is isolated per remora onchain.
- W2 onboarding skips the per-remora delegate step. A3·ui shows "Memory: stored in Remora's account until mainnet" for now.
- The mainnet pass adds the delegate flow before activating each remora, and checks onchain that the delegate is registered.

## Links
- [ADR-0005](0005-walrus-memory-usage-rules.md) · [ADR-0024](0024-testnet-first.md) · [ADR-0026](0026-network-switch.md) · spec §3, §8
