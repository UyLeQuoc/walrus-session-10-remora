# ADR-0035: What the W2 exit e2e changed: a gas coin pool, unmetered W2 reads, unsettled ≠ paid

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Uy (agent, U5 Phase C)

## Context
The first runs of the W2 exit e2e on testnet found four defects that unit tests couldn't:
1. **Shared gas coin.** The testnet sponsor held **one** SUI coin. A Scout's first run (N13) and the owner's first question paid at the same moment. Both sponsored transactions were built on that coin's same version, so one could never execute. The merchant answered 402.
2. **Unsettled marked paid.** That 402 was still recorded as "Paid 0.01 to reef:sui-risk" (no digest, no Wake anchor). `requestPayment` treated any non-thrown result as a purchase.
3. **IP ceiling.** The per-IP ceiling (30/min, 200/h, ADR from hippo) counted every W2 page read. The remora page loads six endpoints and polls the feed, so an owner hit 429 within a minute and the page showed an error.
4. **Lost wallet after reload.** The app doesn't auto-connect wallets. After a reload the server session survived but dApp Kit had no wallet, so every signature failed with "No wallet is connected."

## Decision
- **Gas coin pool (D8)** (`apps/facilitator/src/gas-pool.ts`):
  - `/gas` gives each sponsored transaction its own sponsor coin and holds it until that transaction settles (released in `settle`, executed or refused) or 90 s pass.
  - With every coin held, it waits up to 15 s, then refuses with `sponsor.busy`.
  - Coins under 0.02 SUI (or the max budget, if lower) are skipped.
  - `apps/facilitator/scripts/gas-pool.ts` splits the testnet sponsor into a pool (testnet only). The testnet sponsor now has 6 coins (split `6Qsqg7rJwVBrCPDo4eGYhMMzmbKUGjcuxVWKh9XX4nJ8`).
- **Unsettled ≠ paid.** A non-2xx response or a missing settle digest after a payment attempt is `blocked` with code `x402.unsettled` and the merchant's reason. It never becomes a `payment` event or a source charge.
- **Unmetered W2 reads.** These polled GETs are no longer counted by the IP ceiling:
  - `networks`, `templates`, `feed`, `approvals`, `settings`;
  - `remoras`, `remoras/:id` and its `budget`, `rules`, `sources`, `schedules`;
  - `events/:id/why`.

  They answer only for the signed-in wallet and spend nothing. Memory search, verify, funds and every write still count.
- **Reconnect to sign.** `RequireOwner` shows "Connect wallet to sign" whenever the session's wallet isn't the connected one. Auto-connect stays off (hippo's choice).
- **Exact amounts.** W2 pages show USDC with as many decimals as needed (`usdc()`: 0.015, not 0.01).
- **Streams have no deadline; the watcher backfills.**
  - Root cause: the Tatum transport's 30 s per-call deadline also applied to `SubscribeCheckpoints`, so every stream (the D1 watcher and the U3 indexer) was cut every 30 s ("Deadline exceeded after 30s"). One full run lost a Sentinel ping in such a gap.
  - `PacedTransport` now gives server streams no deadline; they live until their caller aborts them.
  - Since a stream starts at the tip, the watcher also fetches missed checkpoints with `GetCheckpoint` after any reconnect or re-subscribe (up to 200), as the indexer does.
- **Burner hygiene.** Each W2 run creates a Scout with a Disc. With 8 Discs, the burner's Disc panel (read over public gRPC-web) hit "Failed to fetch". So:
  - the W2 e2e now retires its Scout (the owner signs the revoke, which also covers B8 in the UI);
  - global setup revokes any `remora-*` Disc left over from a run that stopped early.

## Consequences
- Throughput scales with the pool size. The pool needs topping up as coins wear down. The mainnet sponsor is sized in the mainnet pass.
- The e2e pipes the facilitator and merchant logs, so a failed payment shows its reason.

## Links
- `apps/facilitator/src/{gas-pool,facilitator}.ts`, `apps/server/src/{tools/pay,iplimit}.ts`, `apps/web/src/features/remoras/hooks.tsx`, `apps/web/src/lib/usdc.ts`
- ADR-0028 (W1 rails), ADR-0032, ADR-0034
