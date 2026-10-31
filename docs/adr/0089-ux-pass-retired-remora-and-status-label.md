# ADR-0089: UX pass, part 2: retired remoras, the status label, and audit pages

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (same ask as [ADR-0088](0088-ux-pass-after-full-e2e.md); built by Uy's agent)

## Context
- **The U8 and U12 rerun passed.**
  - U8 had failed on a Tatum timeout. U12 now passes with the duplicate handling from ADR-0088.
  - With the 46 from the first run, every flow in the suite passes. Two are skipped by design.
- **The audit pass, rerun with ADR-0088's UI, showed two more problems:**
  - **A retired remora's page still offered Ask.** Its budget said "Reading the Disc…" forever,
    because the Disc is revoked and the meter never loads.
  - **`/status` showed the raw item name `tatum.usage`.** The other rows read "tatum (testnet)",
    "relayer budget" and so on.
- **The audit's page list predated `/playground`, `/hatchery`, `/status` and `/reef`.**

## Decision
- **Retired remoras say so.**
  - A "Retired" alert: "Its Disc is revoked, so it can't act or pay. Its memory and receipts stay
    yours."
  - No Ask or Teach card.
  - The budget section reads "Retired: its Disc was revoked, so it never pays again", and the meter
    isn't fetched.
- **The health item is renamed `tatum usage`.** This changes `/api/health/deep`, `/api/status` and
  `/lab/health`. ADR-0080 still describes the item; only its name changes.
- **`e2e/tests/audit.spec.ts` also captures `/playground`, `/hatchery`, `/status` and `/reef`,** in light
  and dark.
- **The refreshed `docs/e2e/screenshots/audit-*` are committed.**

## Consequences
- Every state a remora can be in has a page that matches it: creating, shadow, active, paused and
  retired.
- `/status` reads as plain words throughout.
- The audit set now covers every page in `routes.tsx` except `/p/:token`, which needs a shared Wake,
  and the lab's subpages.

## Links
- [ADR-0088](0088-ux-pass-after-full-e2e.md) ·
  [ADR-0080](0080-tatum-usage-in-health-and-no-resubscribe-backfill.md) ·
  [handoff](../handoffs/2026-10-31-uy-to-huan-ux-pass.md)
