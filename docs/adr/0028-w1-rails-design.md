# ADR-0028: W1 rails design (facilitator as sponsor, queue, keys, indexer)

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Uy Le

## Context
U3 built every W1 rail in Uy's lane and passed the W1 exit on testnet
([docs/spikes/2026-10-19-w1-exit.md](../spikes/2026-10-19-w1-exit.md)). These choices shape W2.

## Decision
- **The facilitator is the gas station and the sponsor (D8)** for its network. The x402 Sui scheme has
  the facilitator co-sign as sponsor at settlement, so the sponsor key lives in `apps/facilitator`.
  - Its policy lives in `@remora/signer` (`Sponsor`). The sponsor must be the gas owner and never the
    sender. It refuses any withdrawal from itself or from an allowance it funds, any use of the gas coin,
    calls outside the Remora package, `0x1` and `0x2`, and gas budgets over a cap.
  - A per-sender daily gas budget lives in `sponsor_ledger`: reserved at `/gas`, settled with real gas
    after execution, and never counted twice. A sponsor balance below a threshold logs
    `sponsor.low_balance`.
- **Merchants settle before the handler runs** (`@remora/merchant`), so unpaid work never leaks. They
  advertise the gas station in `extra.gasStation` and can require Disc payments (`extra.disc`).
- **`discFetch` (E2)** checks a soft budget, builds `disc::pay` with `intent = sha256(canonical Wake
  intent)` (G2), gets the transaction sponsored, signs as the remora, and retries with `x-payment`. The
  server's `payWithDisc` builds the Wake intent from the 402, stores the Wake in `receipts`, and queues a
  `wake.anchor` job.
- **D2 jobs on Postgres:**
  - enqueue is idempotent (unique `idempotency_key`), and claims use `FOR UPDATE SKIP LOCKED`;
  - retries back off exponentially (1 s doubling up to 10 min), and a job that runs out of attempts is
    `dead`;
  - stale `running` jobs are recovered.
- **B4 key custody:** an Ed25519 key per remora, sealed with its own AES-256-GCM data key. The data key
  is wrapped by `KEY_ENCRYPTION_KEY`, and the remora ID is the associated data. Keys are decrypted only
  inside `RemoraSigner.signTransaction`, and the KEK can be rotated by rewrapping.
- **D1 indexer:** `SubscribeCheckpoints` per network, filtered with `emitModule = <pkg>::disc`.
  - Events go to `disc_events`, and the cursor to `indexer_cursors`. A matching `Paid` anchors the
    Wake.
  - On restart it backfills gaps up to 120 checkpoints and logs bigger ones (the stream starts at the
    tip, ADR-0021).
- **K1:** one JSON-lines logger with secret redaction (`@remora/chain` `createLogger`), shared by the
  server, the facilitator and the merchants. Money routes add a request ID and the network.
- **x402 types live in `@remora/disc-sdk`** for now. The contract PR adds the network and API types to
  `packages/schema`.
- **`WORKER` / `INDEXER` env switches** (default on), so local runs don't spend Tatum calls.

## Consequences
- W2 builds remora creation (B1/B3) on `RemoraSigner` + `buildIssue`, and Scout/Sentinel pay through
  `payWithDisc`.
- Deploying `apps/facilitator` and `apps/merchants` is Uy's step (Railway), with
  `SPONSOR_PRIVATE_KEY[_TESTNET]`, `MERCHANT_PAYTO[_TESTNET]`, `DATABASE_URL` and the Tatum keys.
- Booting the full server locally needs a real `MEMWAL_ACCOUNT_ID`.

## Links
- [ADR-0020](0020-allowance-spike-go.md) · [ADR-0021](0021-sui-grpc-only.md) · [ADR-0025](0025-disc-v1-design.md) · [ADR-0026](0026-network-switch.md)
