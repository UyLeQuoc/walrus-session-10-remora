# ADR-0077: The reality check: a payment with no Wake behind it alerts the owner

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (written by Uy's agent)

## Context
- **Threat 3, a leaked key** ([threat model](../threat-model.md)), had prevention but no detection:
  - the Disc caps what a leaked key can spend;
  - the owner can rotate the key or pause the remora.

  Nothing told the owner that the key had been used.
- **The indexer already sees every `Paid`.** It reads the checkpoint stream through Tatum and marks the
  matching Wake anchored. A `Paid` that matches no Wake was stored without a word.
- **Only the remora's key can call `disc::pay`,** and the runtime writes a Wake for every payment it
  decides. So a `Paid` with no Wake means one of two things: the key signed outside the runtime, or a
  Wake was lost (a crash between settling and recording).
- **Where the idea came from.** A Track 3 entry in the same hackathon reconciles real transfers with the
  decisions in memory, and its write-up finds two of four transfers with no approval behind them. Only
  the write-up was read, not its code.

## Decision
- **Queue a check.** When the indexer stores a `Paid` that anchors no Wake, it queues a
  `disc.paid_check` job for 3 minutes later. The job's idempotency key is network, digest and event, and
  it gets up to 3 attempts.
  - The Wake is written right after the payment settles, so the indexer can see the event first. The
    wait keeps a normal payment from raising an alarm.
- **Run the check.** The job looks for a Wake with the payment's intent hash.
  - **Found:** nothing happens.
  - **Not found, and the Disc is a remora's:**
    - an `action` event goes on the remora's feed with `unexplained: true`, the digest, the amount and
      `payTo`;
    - an urgent notice goes to the owner: "A payment from <name>'s Disc has no decision behind it: <amount>
      USDC to <payTo>. If it wasn't you, rotate its key or pause it.";
    - a `disc.unexplained_payment` warning is logged.
  - **A Disc that's no remora's:** it's logged and dropped.
- **No new table and no schema change.** It uses the existing event type, so the feed and its contract
  don't change.

## Consequences
- **Threat 3 gains detection.** A leaked key shows up within minutes of its first payment, and the owner
  has the two actions that stop it.
- **A lost Wake also raises the alert.** That's right: a payment without a receipt is worth telling the
  owner about, whatever the cause.
- **It depends on the indexer.** It runs on the instance with `INDEXER=on` and a worker. A checkpoint
  gap larger than the backfill limit can skip a `Paid`, the same as for anchoring.
- **Demo line:** "Remora catches a payment it didn't decide."

## Links
- [threat-model.md](../threat-model.md) row 3 · [ADR-0007](0007-wake-receipts.md) (Wake receipts) ·
  [ADR-0021](0021-sui-grpc-only.md) (the checkpoint stream)
- `apps/server/src/triggers/indexer.ts`, `apps/server/src/runtime/reality.ts`
