# apps/facilitator

The x402 `exact` facilitator for Sui (E3) and the gas station + sponsor (D8), one per network (ADR-0026, ADR-0028).

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** E3, D8, E13 (public on testnet since U17, [ADR-0111](../../docs/adr/0111-scale-pass.md))
- **Endpoints:**
  - `GET /supported`;
  - `POST /verify` (signature, sponsor policy, Tatum simulate, `payTo` change == amount, not executed, Disc-aware `Paid`);
  - `POST /settle` (sponsor co-signs, execute, wait);
  - `POST /gas` (gasless kind → sponsored transaction, per-sender daily budget);
  - `GET /health`.
- **Run:** `FACILITATOR_PORT=8798 bun run --filter @remora/facilitator start`. Needs `TATUM_API_KEY[_TESTNET]`, `SPONSOR_PRIVATE_KEY[_TESTNET]` (never a funder) and `DATABASE_URL` for the ledger (it falls back to memory with a warning).
- **Status:** passed the W1 exit on testnet (`docs/spikes/2026-10-19-w1-exit.md`). Deploying it is Uy's step.

## Public facilitator (testnet)
Since U17 ([ADR-0111](../../docs/adr/0111-scale-pass.md)), any Sui x402 merchant on testnet can use
this facilitator. The facilitator itself stays on `127.0.0.1` in the container, and the API forwards
to it (`apps/server/src/routes/facilitator.ts`).

- **Base URL:**
  - `https://getremora.vercel.app/api/facilitator` (through the web);
  - or the API's own domain plus `/api/facilitator`.
- **Endpoints:**
  - `GET /api/facilitator`: what it is, its limits and these docs;
  - `GET /api/facilitator/supported`;
  - `POST /api/facilitator/verify` and `POST /api/facilitator/settle`, with x402's
    `{ paymentPayload, paymentRequirements }`;
  - `POST /api/facilitator/gas`, the gas station your buyers' clients call (`extra.gasStation` in
    your 402).
  - `GET /api/facilitator/discovery/resources`, the Reef as an x402 Bazaar catalog
    ([ADR-0141](../../docs/adr/0141-x402-discovery-catalog.md)).
- **Limits:**
  - `sui:testnet` only;
  - 200 settlements per `payTo` per UTC day. This caps the gas we sponsor for one merchant; the
    sponsor also caps gas per sender per day;
  - 10 gas-station calls per client address per minute, since each one holds a sponsor coin;
  - the API's 30 requests a minute per address.

  A limit answers `429` with a code (`facilitator.daily_cap`, `facilitator.busy`).
- **Sell an API in about 20 lines:** see [`examples/sell-an-api`](../../examples/sell-an-api). Then
  list its URL in the Reef, so remoras can buy it.
