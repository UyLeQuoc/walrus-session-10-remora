# apps/facilitator

The x402 `exact` facilitator for Sui (E3) and the gas station + sponsor (D8), one per network (ADR-0026, ADR-0028).

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** E3, D8, E13 (public later)
- **Endpoints:**
  - `GET /supported`;
  - `POST /verify` (signature, sponsor policy, Tatum simulate, `payTo` change == amount, not executed, Disc-aware `Paid`);
  - `POST /settle` (sponsor co-signs, execute, wait);
  - `POST /gas` (gasless kind → sponsored transaction, per-sender daily budget);
  - `GET /health`.
- **Run:** `FACILITATOR_PORT=8798 bun run --filter @remora/facilitator start`. Needs `TATUM_API_KEY[_TESTNET]`, `SPONSOR_PRIVATE_KEY[_TESTNET]` (never a funder) and `DATABASE_URL` for the ledger (it falls back to memory with a warning).
- **Status:** passed the W1 exit on testnet (`docs/spikes/2026-10-19-w1-exit.md`). Deploying it is Uy's step.
