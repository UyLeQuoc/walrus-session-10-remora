# ADR-0008: Create a remora in two sponsored steps

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
The Walrus Memory relayer sponsors **exactly one** of `create_account`, `add_delegate_key` or
`remove_delegate_key` per transaction. The allowance and the Disc need their own transaction.

## Decision
1. `add_delegate_key`, sponsored by the relayer, so the owner needs no SUI. The delegate is verified
   onchain before the remora is activated.
2. `propose_for_app` + `disc::issue`, sponsored by Remora's gas station.

*Stretch:* both steps in one PTB sponsored by our own gas station.

## Consequences
- Two signatures in the MVP.
- Every new remora starts in shadow mode (N3).

## Links
- [remora-spec.md §3](../remora-spec.md#3-what-a-remora-is)
