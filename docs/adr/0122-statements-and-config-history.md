# ADR-0122: Statements and spend analytics (E6), and config history (N11)

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 B6, C3)

## Context
Goal U18 ([spec](../goals/uy-18-learning-loop.md), [ADR-0119](0119-u18-learning-loop-everyday-money.md))
asks for two parts with no schema push:
- **B6 (E6):** a monthly statement per remora, per payee and per day, a CSV with one row per payment,
  a page that prints, and anomaly flags (a big day, a new payee, a price change, a run of failed
  payments), from what we already record.
- **C3 (N11):** every config change as a version with the config before and after, a diff, and
  Restore, where money fields need the owner's signature through the same builders.

What the code records today:
- **A remora's payment:** a `payment` event (payee, amount, digest, `receiptId`) and its Wake in
  `receipts` (intent hash, `decision.payTo`), with the same digest. `disc_events` holds the indexed
  `Paid` (amount, payee, intent).
- **An owner-approved payment:** a `payment` event with `approvedBy: "owner"`, paid from the owner's
  own wallet (no Disc, so no `Paid`); its answer Wake carries the same digest with `action: "answer"`.
- **Edge cases:** a Wake can settle while the service answers an error (the event is then `blocked`,
  `x402.unsettled`); an unexplained `Paid` becomes an `action` event with `unexplained: true`
  (ADR-0077).
- **Failures:** there's no "failed" row; a payment that didn't go is a `blocked` event with a `code`.
- **Config:** only `edit` wrote `config_changed` (with `previous`). Budget, payees and sale changes
  wrote `action` events; schedules and the Briefer's list wrote the row and nothing, or an `action`.

## Decision
### Statements (E6)
- **Routes** (owner session, the session's network): `GET /api/statements?month=YYYY-MM` and
  `GET /api/statements/csv?month=YYYY-MM`. The contract is `Statement` in `packages/schema`.
- **Days are the owner's timezone** (`owner_settings.timezone`, UTC by default or when invalid). A
  month without `?month=` is this month there.
- **One payment, one row:** every `payment` event (the remora's, or the owner's when `approvedBy` is
  `owner`), then each settled pay Wake whose digest no event has, then each unexplained `Paid`.
  Rows are deduplicated by digest; the answer Wake of an approval is never a payment (its action is
  `answer`). A row is **matched onchain** when its Wake is anchored or `disc_events` has a `Paid` with
  the same digest and amount; owner-paid rows are `n/a`.
- **Flags:**
  - **spike:** a day's total is more than **3×** the median of the **14 days before it** (days with no
    spend count as 0) **and at least 0.10 USDC**. The floor keeps a quiet account's first 0.02 from
    being an anomaly while a median of 0 still lets a real jump through;
  - **new payee:** the owner's first payment ever to a payee (across their remoras on the network);
  - **price change:** a payment to a service (`reef:` payees) that differs from that service's
    previous payment by **≥20%**, up or down. People (an Errand's contacts) are paid what each errand
    costs, so they're never a price change;
  - **price hike:** any `price_hike` event a remora wrote (the Subscriptions Keeper, B2) in the month;
  - **failed run:** **3 or more failed payments in a row** from one remora, with no payment of its own
    in between. A failed payment is a `blocked` event whose code isn't a deliberate refusal; the
    refusals are `sonar.*`, `sale.*`, `over_limit` and `remora.not_active`. Everything else
    (`x402.unsettled`, `disc.*`, `allowance.*`, `funds.*`, `sponsor.*`, `rate_limited`,
    `remora.no_disc`, `unknown`) is a failure.
- **CSV columns:** `time` (ISO, UTC), `remora`, `payee` (its label), `pay_to`, `amount_usdc` (six
  decimals), `amount_units`, `digest`, `intent` (the Wake's intent hash, `Paid.intent`), `memo` (when
  a payment carries one), `verify_url` (`<WEB_BASE_URL>/verify/<digest>`, or the Wake's id without a
  digest), `paid_by` (`remora` or `owner-approved`), `matched_onchain` (`yes`, `no` or `n/a`). Cells
  are RFC 4180 quoted, and a cell that starts with `=`, `+`, `-` or `@` gets a leading `'` so a
  spreadsheet never runs it.
- **The page** is `/statements`, linked from Funds: the total and who paid it, failed attempts, a bar
  a day, the flags, per remora and per payee, Download CSV and Print. Printing hides the shell
  (`print.css`, scoped to a page carrying `data-statement`) and switches a dark screen to the light
  theme for the print.

### Config history (N11)
- **One helper, `saveConfig`** (`apps/server/src/runtime/config-versions.ts`), writes a config change:
  it locks the row, applies the change to the current config, bumps `revision`, and writes one
  `config_changed` event with `previous` (the config before, the name `edit` already used), `after`,
  `revision` and `fields`, in one transaction. Each caller keeps its own summary and payload fields
  (`digest`, `budget`, `payees`, `sale`, `schedule`).
- **Versioned writes:** `edit` (name, persona, brain, watched wallets), the budget and payee confirms,
  the sale, schedules (add, pause, remove) and the Briefer's list. The budget, payee, sale and
  schedule events change type from `action` to `config_changed`, with the same sentences. Restoring is
  itself a version.
- **Not versioned:** the key generation after a rotation, the pause bookkeeping (`tgWas`, `crewWas`),
  a crew set at team import, and API listings kept on a holder remora. They're bookkeeping or another
  thing's data, not this remora's settings, and restoring them would be wrong (an old key, an old
  status). They keep their own events.
- **Versions:** the config before the first change (`initial`), then each change's config after it,
  newest first. An older `edit` event without `after` takes the next change's `previous`, or the
  config now.
- **Restore:**
  - name, persona, brain, triggers and the sale apply at once, as a new version. A brain no longer in
    the catalog, or a sale whose name is now taken, is skipped or refused;
  - a webhook trigger comes back only if its id is still current: its secret is derived from the id
    (C4), so a rotated or removed hook stays rotated or removed;
  - **the spending limit and the payees never apply here.** Restore returns `budgetTx` (when the
    limits differ; it carries the payees too) or `payeesTx`, the owner signs, and the existing
    `/budget/confirm` or `/payees/confirm` applies it and records the version;
  - everything else (schedules, the Brief list, listings, the crew, and any field a later part adds)
    is shown in the diff and left as it is.
- **Routes:** `GET /api/remoras/:id/history`, `GET /api/remoras/:id/history/:version` and
  `POST /api/remoras/:id/history/:version/restore`. The contracts are `ConfigHistory`,
  `ConfigVersionDiff` and `ConfigRestore`. The web shows them under Settings → History.

## Consequences
- **Easier:**
  - an owner sees and prints a month, and the CSV matches the chain digest by digest;
  - every settings change is a version with a diff, and money stays behind a signature;
  - a concurrent change no longer overwrites another (the row is read under a lock).
- **Harder:**
  - a statement reads the owner's whole history up to the month's end (baselines need it). That's
    fine at our volume; an index or a rollup comes later if it isn't;
  - a new config writer must call `saveConfig`, or its change isn't a version. Parts that add config
    fields (contacts, hooks) should go through it; an unknown field is shown but never restored;
  - the feed shows budget, payee, sale and schedule changes as "edited" rather than "acted".
- **Docs:** the U18 exit note covers how this was checked; the ADR index row is added at merge.

## Links
- [Goal U18](../goals/uy-18-learning-loop.md), [ADR-0119](0119-u18-learning-loop-everyday-money.md).
- [ADR-0077](0077-reality-check-unexplained-payments.md) (unexplained payments),
  [ADR-0076](0076-u9-backend-for-huan-pages.md) (cost card), [ADR-0103](0103-visual-first-ui-pass.md)
  (visual-first), [ADR-0109](0109-pay-only-at-listed-address.md).
