# ADR-0116: SuiNS names for remoras are cut from U17

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U17, [ADR-0111](0111-scale-pass.md))

## Context
U17's C3 asked for a SuiNS leaf name for each new remora on testnet, resolved over gRPC. It came
with a fallback: "ADR for the SDK, or cut it". It's last in U17's cut order. Two facts were checked
on Nov 4:
- **Resolving works over gRPC.** `@mysten/sui` 2.36's `core.resolveNameServiceAddress` calls
  `NameService.LookupName`, and on testnet it resolved `demo.sui` to its address. We can read names
  without JSON-RPC.
- **Making names needs more than we have.** Creating leaf subnames needs a parent name that we own
  on testnet, and the SuiNS SDK to build those calls. `@mysten/suins` 2.0.19 needs
  `@mysten/sui` ^2.39 (the repo is on 2.36) and pulls in `axios` and `axios-retry`. Taking it means
  bumping the Sui SDK across every package, a few days before the freeze, for the least important
  door.

## Decision
- C3 is cut from U17. No SuiNS dependency is added.
- The way to build it is on Uy's list:
  1. bump `@mysten/sui` to 2.39 or later in one PR, with its own ADR;
  2. add `@mysten/suins`;
  3. register a testnet parent name;
  4. give each new remora a leaf name and resolve it with `resolveNameServiceAddress`.

## Consequences
- **Addresses only:** remoras are still shown by address. The README's "not yet" keeps SuiNS names.
- **Nothing changes in the code.**

## Links
- [ADR-0111](0111-scale-pass.md)
- [ADR-0115](0115-telegram-mini-app-and-mcp-links.md)
