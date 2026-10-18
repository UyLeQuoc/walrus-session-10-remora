# ADR-0024: Testnet first; mainnet only when Uy says

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Uy Le

## Context
U1 proved the allowance rails on testnet through Tatum (ADR-0020). Its mainnet step needed funding plus
Uy's OK on every transaction. Uy deferred it twice: "làm hết trên testnet đi, mainnet để sau cũng
được" (Oct 18) and "làm hết testnet đã" (Oct 19). The W1 plan had E1's Move package going to mainnet on
Thu Oct 23.

## Decision
- **Build and verify on testnet first.** That covers Move publishes, the Disc, disc-sdk, the
  facilitator, sponsor and e2e flows. Every goal's done-criteria are met on testnet, through Tatum gRPC.
- **Mainnet only when Uy says so,** as its own pass. Uy funds the keys, and every mainnet transaction
  still needs his OK first (≤ 0.10 USDC each during spikes). U1's mainnet step (ADR-0020) moves to that
  pass, before the first mainnet publish.
- **Agents may publish Remora's Move package to testnet** inside Uy's goals, using the spike keys from
  `.env`. Mainnet publishes stay with Uy.
- Testnet IDs go in `packages/schema` `DEPLOYMENTS.testnet` through a contract PR.

## Consequences
- W1's exit criterion becomes testnet: a real x402 call paid from a remora key through its Disc,
  sponsored, funded from the owner's address balance. The same run is repeated on mainnet when Uy calls
  the mainnet pass. The submission still needs mainnet before Nov 9.
- `AGENTS.md`'s "never publish the Move package" now means "never publish to mainnet".
- The U1 goal's mainnet step and done-criterion point here.

## Links
- [ADR-0020](0020-allowance-spike-go.md) · [remora-plan.md W1](../remora-plan.md#w1--rails-mon-oct-20--sat-oct-25) · [goals/](../goals/README.md)
