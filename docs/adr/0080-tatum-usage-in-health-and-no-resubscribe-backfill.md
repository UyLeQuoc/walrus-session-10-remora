# ADR-0080: Tatum usage in health, and no backfill on a watched-set re-subscribe

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (written by Uy's agent)

## Context
[ADR-0058](0058-tatum-credit-budget.md) set Tatum's credit rules after a month of free-plan credits went
in a few days. It left three follow-ups, which U9 Phase B lists:
1. **The e2e should retire or pause the Sentinels it creates.**
2. **A re-subscribe because the watched set changed shouldn't backfill.** Every new Sentinel or address
   edit re-subscribes. The first frame of the new stream then backfilled the switch's gap with one
   `GetCheckpoint` per checkpoint, and the e2e makes many such changes.
3. **Health should show `tatum.usage` for the last hour.** The server only logged its usage since start
   every 10 minutes.

## Decision
- **Health gains a `tatum.usage` item.**
  - `PacedTransport` now also counts requests and stream frames per minute. `tatumCallsLastHour()` sums
    the last 60 minutes.
  - The item is `ok` up to 1,400 an hour (1M credits a month, spread over its hours). Above that it's
    `degraded`, with a fix that points at unfiltered streams and call loops.
  - It also shows on the public `/status`, by name and status only.
- **No backfill after a set change.** When the watcher re-subscribes because the watched set changed, it
  skips the gap and logs `watcher.resubscribed { skipped }`. A reconnect after a failure still
  backfills, as before.
- **The e2e cleanup stays with Huấn.** `e2e/` is his lane ([team-split](../team-split.md)). The note is
  in the U9 handoff.

## Consequences
- **A credit leak shows on `/status` within the hour,** not in a month's bill.
- **A transfer to an address already watched can be missed** if it lands in the switch's few checkpoints
  (about a second or two). Set changes are rare outside the e2e, and the alternative spends credits on
  every change.

## Links
- [ADR-0058](0058-tatum-credit-budget.md) · [U9 goal](../goals/uy-09-testnet-launch.md) Phase B ·
  `packages/chain/src/paced.ts`, `apps/server/src/triggers/watch.ts`, `apps/server/src/ops/health.ts`
