# ADR-0026: One deployment, both Sui networks, with a network switch in the UI

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Uy Le

## Context
We build and verify on testnet first, and mainnet arrives as Uy's pass (ADR-0024). The demo and the
judges need mainnet, while day-to-day work and dogfooding stay cheap and safe on testnet. Uy wants a
**network switch on the UI** ("trên UI sẽ có nút switch network cho tiện") instead of separate
deployments. ADR-0009 keeps one deployed environment (`main`).

## Decision
- **The `main` deployment serves both `testnet` and `mainnet`.** The network is chosen per session in
  the UI and sent on every API call as the `x-remora-network` header (`testnet` | `mainnet`).
- **A network is *available* only when its `DEPLOYMENTS[network].remoraPackageId` is set** and the
  server has its keys. `GET /api/networks` lists what's available. Mainnet stays disabled until Uy's
  mainnet pass publishes it. The default is testnet until then, and mainnet after.
- **Server side, everything chain-related is per network:**
  - the Tatum client (`@remora/chain`) and the sponsor key (`SPONSOR_PRIVATE_KEY[_TESTNET]`);
  - the facilitator network (`sui:testnet` / `sui:mainnet`) and the demo merchants' `payTo`;
  - the checkpoint indexer's stream and cursor;
  - every chain-bound DB row (Discs, payments, Wake payment fields, sponsor ledger) carries a
    `network` column.
- **A remora lives on one network.** It's created on the session's network and never moves.
  Switching the UI switches which remoras, Discs and funds you see.
- **Walrus Memory stays on mainnet** on both networks. It's a hackathon requirement, memory isn't
  money, and the MemWal account belongs to the owner address, which is the same on both networks.
- **Browser:** gRPC-web per network (`https://fullnode.<network>.sui.io:443`). The wallet has to be on
  the same network. The UI warns on a mismatch and shows a clear **TESTNET** badge.

## Consequences
- New feature **A9 Network switch** (ship set): A9·be in Uy's U3 goal, A9·ui in a handoff to Huấn.
- `packages/schema` gets a contract change: `Network`, the header name and the `/api/networks`
  response.
- Every chain-touching module takes a `network` argument. Nothing reads one global network.
- `SUI_NETWORK` in `.env` becomes only the default network.

## Links
- [ADR-0009](0009-deploy-railway-vercel-single-env.md) · [ADR-0021](0021-sui-grpc-only.md) · [ADR-0024](0024-testnet-first.md) · [ADR-0025](0025-disc-v1-design.md)
