# ADR-0144: Pay a `.sui` name, resolved over gRPC; a moved name stops the payment

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
- People know each other's `.sui` names, not hex addresses. ADR-0116 cut SuiNS from U17 for time.
- The gRPC API has `sui.rpc.v2.NameService` (`LookupName`, `ReverseLookupName`), and the `@mysten/sui`
  gRPC client exposes it as `core.resolveNameServiceAddress` and `core.defaultNameServiceName`. Probed
  on testnet on Nov 5 through our client (Tatum 402, so the public fullnode answered): `demo.sui`
  resolved; the burner had no reverse name. No JSON-RPC and no `@mysten/suins` needed.
- ADR-0109: a remora pays only listed payees at their listed address. A name is a pointer its owner
  can move at any time, so a name can't be what the owner signs for.

## Decision
- **A contact can be added by name** ("linh.sui", "@linh"): the server resolves it, the owner signs
  the usual `buildSetPayees` for the **address**, and the contact keeps the name, that address and
  when it was resolved (`config.contacts[].suins`, `resolvedAt`; optional fields, no schema push).
- **Before each payment to such a contact the name is resolved again.** If it now points anywhere
  else, or can't be checked, the Errand doesn't pay, says what changed ("linh.sui now points to
  0x…, not 0x…, the address you signed for"), and records a `blocked` event (`name.moved` or
  `name.unchecked`). Re-adding the contact (one signature) is the only way to follow a moved name.
- **Names beside addresses:** `GET /api/names?addresses=` (reverse) and `/api/names/resolve?name=`,
  public like the chain they read, rate-limited, cached for an hour on the server. The web's
  `Address` and the Reef and public-receipt payees show the name first, with the address one tap away.
- **A testnet name for the second test owner** is registered with a raw `moveCall` to the SuiNS
  testnet packages (ids checked against the SuiNS docs), or, if that takes more than 2 hours, an
  existing testnet name is used for display only and the registration goes on Uy's list.

## Consequences
- The Telegram photo handler and other places read the owner's testnet Errand; names on mainnet wait
  for the mainnet pass (ADR-0024).
- SuiNS subnames and paying a name never added as a contact stay out of scope.

## Links
- ADR-0109, ADR-0116, ADR-0125, ADR-0134; [SuiNS developer docs](https://docs.suins.io/developer);
  [Sui gRPC NameService](https://www.alchemy.com/docs/reference/sui-grpc-name-service.md)
