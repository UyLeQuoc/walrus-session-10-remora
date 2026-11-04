# ADR-0124: A remora proposes its own budget, citing the memories behind it

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 A1, [ADR-0119](0119-u18-learning-loop-everyday-money.md))

## Context
Best Walrus Memory rewards "the deepest learning loop". A remora already writes what it paid for
(Wakes in `receipts`) and how its sources did (`SOURCE` scores in `sources`) to Walrus Memory, but
nothing it learns ever changes its own limits: the owner has to notice. The `approvals` table already
has a `budget_change` kind that nothing used, and a budget change is already one owner signature
(`budgetTx`, revoke and reissue in one PTB).

## Decision
- **Rules in code decide when and what** (`runtime/proposals.ts`, `ruleFor`), most urgent first:
  - **approvals:** at least 2 over-limit approvals in 7 days → raise the per-payment cap to the
    biggest ask (never above the window limit);
  - **near_limit:** at least 80% of the window used with more than 30% of it left → raise the limit
    to the pace plus a tenth, between 1.5x and 3x;
  - **cap_hit:** at least 5 payments in 7 days, all at the cap → raise the cap 1.5x;
  - **unused:** at least 7 days on this budget and under 20% used → lower the limit to twice the
    last week's pace, never under three payments at the cap.
- **The model writes only the one-line reason,** from the numbers and the cited memories it's
  shown. If it fails, a fixed sentence from the numbers is used.
- **A proposal cites 2–5 stored memories, or isn't made:** the latest paid Wakes, the source scores and
  how the last proposal ended. Each is a `remora_memories` row with a Walrus blob id. Labels come
  from the rows written at the same moment (the receipt beside a Wake, the fact a score became),
  never from the model. The card links each one to the Memory Inspector.
- **Storage, with no schema push:** an `approvals` row of kind `budget_change` (payload
  `kind: "proposal"`, the rule, from and to budgets, numbers, cites, reason). One open proposal per
  remora.
- **Accept** is the owner's one signature through `budgetTx`; `confirmBudget` checks the chain.
  **Decline** is one click with an optional reason.
- **The loop closes in memory:** the outcome is written to the remora's `feedback` namespace
  (`PROPOSAL <rule> · <change> · accepted|declined · because … · as_of …`, owner-asserted). The
  next proposal cites it and tells the model how the last one ended. After a decline, the same rule
  waits 7 days.
- **When:** a `proposal.check` job after each payment and each over-limit ask (once an hour at
  most), which then re-queues itself daily; plus "Check now" on the card.
- **Where it shows:** the remora page's "Its budget" card, the approvals inbox ("Review" opens the
  card) and a Telegram notice with a link.

## Consequences
- A remora's memory now changes its limits, but only through its owner's signature.
- A fresh remora proposes nothing until a memory it can cite has landed (about 24 s after a write).
- The rules are conservative and pure, so they're unit-tested alone; the end-to-end path is
  tested against Postgres with the chain read injected.

## Links
- `apps/server/src/runtime/proposals.ts`, `apps/web/src/features/remoras/proposal-card.tsx`.
- [ADR-0074](0074-memory-facts-and-admission.md) (facts and owner-asserted memories).
