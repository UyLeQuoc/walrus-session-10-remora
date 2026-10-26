# ADR-0059: Launch on testnet first; the mainnet pass becomes U10

- **Status:** Accepted
- **Date:** 2026-10-24
- **Deciders:** Uy

## Context
U9 was written as the mainnet pass plus the first deploy. On Oct 24 Uy chose to finish everything on testnet first ("giờ cứ testnet đi"). The mainnet pass needs Uy's funds, keys and a signature on every transaction. The rest of the launch doesn't, and it's what judges will touch:
- a public URL;
- the playground;
- `/status`;
- Huấn's W3 web items;
- a red-team eval;
- the license.

Memory is already on mainnet: the MemWal relayer is mainnet-only (ADR-0026), and the operator account holds 188 memories. So the submission's "Walrus Memory writing on mainnet" is met without the money pass.

## Decision
- **U9 is the testnet launch.**
  - **Deploy** on testnet: API + runtime, facilitator, merchants, web, Postgres. Uy runs the deploy steps.
  - **Clear the queue:** Huấn's PR #11, `/status`, and his accepted backend requests.
  - **Add** the red-team eval suite (I3) and the Sentinel → Scout handoff that the demo needs (D5).
  - **Docs:** the license and the launch docs.
  - **Exit:** the demo path runs twice on the deployed testnet URL.
- **U10 is the mainnet pass:**
  - both Move packages with multisig `UpgradeCap`s, and `DEPLOYMENTS.mainnet`;
  - owned memory (ADR-0030);
  - mainnet services;
  - H6 Walrus Sites, which needs WAL on mainnet and has no public testnet portal.

  Uy calls it when funds and keys are ready. If it doesn't land by Nov 6, the submission ships on testnet money with mainnet memory, and the README says so plainly.
- The deployed app says **"Testnet"** wherever money is shown, as the network badge already does.

## Consequences
- Judges get a live URL sooner, and nothing irreversible happens without Uy.
- Real-money claims (the mainnet allowance, mainnet digests) wait for U10. The README and blog keep their **[mainnet]** markers until then.
- The demo video can be recorded on testnet if U10 is late.

## Links
- ADR-0024 (testnet first), ADR-0026 (networks), ADR-0030 (owned memory), ADR-0051 (playground), ADR-0058 (Tatum budget)
- [U9 goal](../goals/uy-09-testnet-launch.md), [U10 goal](../goals/uy-10-mainnet-pass.md)
