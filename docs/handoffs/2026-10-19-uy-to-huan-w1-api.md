# Handoff: Uy → Huấn, the W1 API for the UI (U3)

- **Date:** 2026-10-19 · **From:** Uy (goal U3) · **To:** Huấn (or U4) · **Status:** open
- Every call sends `x-remora-network: testnet | mainnet` ([ADR-0026](../adr/0026-network-switch.md)). A bad or unavailable network gets
  `400 { error: { code: "network.unavailable", message } }`.

| Endpoint | Returns | UI |
|---|---|---|
| `GET /api/networks` | `{ default, networks: [{ network, available, reason?, packageId, usdcCoinType }] }` | the header switch (A9) and its disabled state |
| `GET /api/funds?owner=0x…&remoras=0x…,0x…` | `{ network, splits: FundsSplit[], movable }` (schema `DetectFundsResult`) | Detect funds (A4): "ready (address balance) · in coins → Move" |
| `POST /api/funds/move` `{ owner, amount? }` | `{ network, transaction }`: a Transaction JSON | the wallet signs and executes it (`Transaction.from(json)`) |
| `POST /api/funds/withdraw` `{ owner, amount }` | `{ network, transaction }` | "Withdraw to coin" under Advanced |

**Error codes** the UI can see (copy keys `error.<code>`):
- `network.unavailable`, `funds.bad_address`, `funds.bad_request`, `funds.no_coins` (server);
- `disc.*` (handoff of Oct 19);
- `sponsor.out_of_gas`;
- `simulation_failed:<code>`: strip the prefix and show the inner code.

New codes are proposed in the U3 contract PR.

**Discs in the browser:** `@remora/disc-sdk` `listOwnerDiscs(client.core, cfg, owner)` with a gRPC-web `SuiGrpcClient`, and `buildPause(cfg, ids, true)` for the panic button. Get `cfg` from `DEPLOYMENTS[network]`: `{ packageId: remoraPackageId, registryId: discRegistryId, coinType: usdcCoinType }`.
