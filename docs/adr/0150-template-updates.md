# ADR-0150: Template updates as approvals; money is always a signature

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
Goal U19's D3 (M8 in [remora-features.md](../remora-features.md), spec in
[uy-19-it-gets-better.md](../goals/uy-19-it-gets-better.md)): when a template's author publishes a
new version, the remoras hatched from an older one should hear about it, see what would change, and
take it or leave it.

What we had:
- A template is frozen when published. A new version is `hatchery::publish_derived`, whose
  `Published` event has a `parent` ([ADR-0047](0047-hatchery-move-package.md)). Someone else's remix
  has a `parent` too.
- `hatchery_forks.remora_ids` lists, in file order, the remoras we created for each hatch.
- Every settings change goes through `saveConfig` as a `config_changed` version, and restore applies
  the spending limit and payees only through a signed transaction
  ([ADR-0122](0122-statements-and-config-history.md)).
- `approvals.kind` already has `template_update`. No schema push in U19
  ([ADR-0134](0134-u19-it-gets-better-and-anyone-can-check.md)).
- A team file carries, per remora, a persona, a brain, a budget, a Wallet watcher's rules, price and
  webhook triggers, schedules and a Briefer's list; tools and Reef services come from the remora's
  kind ([ADR-0042](0042-grok-bots-shape.md)).

## Decision
- **Who is offered an update:**
  - when a `Published` with a `parent` is ingested (our confirmation and the checkpoint indexer both
    call it), the new version's older versions are the chain of parents **by the same author** on
    the same network (20 at most);
  - every live remora hatched here from one of those gets one `template_update` approval;
  - a remix by someone else offers nothing, and neither does a version that's deprecated or blocked
    by the safety review.
- **What it's diffed against:**
  - the version the remora runs: the last update it accepted on that line, else the one it was
    hatched from;
  - its entry in the file is matched by name and kind, else by place and kind.
- **The diff:** persona, brain, tools, triggers (price and webhook), Reef services, rules and the
  spending limit.
  - A field is offered only when the author changed it between the two versions and the remora's
    value would change.
  - Lists merge: what the author removed goes, what they added comes, what the owner added stays.
  - A version that drops its suggested limit or brain leaves the remora's own.
  - Schedules and a Briefer's list aren't offered; they're the owner's.
- **Accept** recomputes the diff against today's settings.
  - Persona, brain and triggers apply through `saveConfig`: one `config_changed` version with
    `source: "template vN"`, the template ids and the approval. History shows "took template vN".
    New price triggers arrive paused; a new webhook gets a fresh id, as on import.
  - A Wallet watcher's added rules are taught, and removed ones switched off; they're named in the
    same version.
  - Tools come from the remora's kind and aren't changed.
  - **Money never applies by itself.** The spending limit and the Reef services come back as a
    prepared transaction (`budgetTx`, or `payeesTx` when only the services change). The owner signs
    it, and the usual `/budget/confirm` or `/payees/confirm` applies it. Until the limit matches, the
    card keeps a "Sign the new limit" button (`…/sign` rebuilds it).
- **Decline** takes an optional reason.
  - It's remembered: a `TEMPLATE_UPDATE … declined` line in the remora's memory (`feedback`, or
    `rules` for a Wallet watcher), and an `action` line in its feed.
  - That version is never offered to that remora again. A later version is, diffed against what it
    runs.
  - Declining from the approval inbox does the same.
- **One offer at a time:** a newer version expires an offer still open. An advisory lock per remora
  keeps our confirmation and the indexer from offering twice.
- **Publishing a version:** Share offers "a new version of" each of the author's live templates
  (`parent` on `/api/hatchery/publish`, as before).
- **One card per line:** the gallery shows a line's newest live version by the same author. An older
  version's page says there's a newer one and links to it (`newer` on the listing).
- **Surfaces:**
  - the offer is an `action` line in the feed, since an approval card there would show payment
    buttons;
  - the owner gets a notification with a link to the remora's page (`?update=`);
  - the remora page's card shows the diff, with Accept and Decline, and the money part marked
    "sign";
  - the inbox links to that card.

## Consequences
- **Easier:**
  - authors can improve a template without hatchers losing their changes;
  - an owner sees exactly what changes, and money still takes their signature.
- **Harder:**
  - updates reach only remoras hatched here, not hatches recorded elsewhere;
  - a renamed remora in a multi-remora template is matched by its place;
  - schedules and lists don't travel with updates.
- **Docs:** `docs/remora-features.md` (M8) and the README's Hatchery lines at Part E.

## Links
- [ADR-0042](0042-grok-bots-shape.md), [ADR-0047](0047-hatchery-move-package.md),
  [ADR-0122](0122-statements-and-config-history.md), [ADR-0134](0134-u19-it-gets-better-and-anyone-can-check.md),
  [ADR-0149](0149-template-ratings-badge.md)
- Code: `apps/server/src/hatchery/updates.ts`, `apps/server/src/hatchery/extras-routes.ts`,
  `apps/web/src/features/remoras/template-update-card.tsx`
