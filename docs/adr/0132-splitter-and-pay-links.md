# ADR-0132: The Errand splits bills, settles what the owner owes, and sends pay links for the rest

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 B3, [ADR-0119](0119-u18-learning-loop-everyday-money.md))

## Context
Splitting a bill with friends is the most common shared money of a week. The Errand already pays
contacts within its limit (ADR-0125), and the public page showed that anyone can pay from a testnet
wallet with sponsored gas (ADR-0126).

## Decision
- **Words, to the Errand** (web or Telegram):
  - "I paid 12 for dinner for Linh, Huy and me", "Linh paid 9 for taxi for me and Huy" and
    "split 30 for groceries with Linh" add an expense;
  - "balances" shows them;
  - "settle up" closes the book.
  - Patterns only, no model.
- **Math:**
  - each share is the amount divided evenly in smallest units, rounded down; the payer keeps the
    remainder;
  - only debts involving the owner are kept: if Huy owes Linh, that's between them.
- **Storage:** the Errand's config `splits {expenses, links, settledAt}`, through `saveConfig`, so
  each change is a version. No schema push.
- **Settle up:**
  - what the owner owes a contact, the Errand pays through `payContact`: its limit, Sonar, the
    receipt, the memo "settle up: …";
  - an owed person who isn't a contact is listed, not paid;
  - for each person who owes the owner, it makes a pay link `/pay/<token>`.
- **The pay link:**
  - a public page shows who owes what, to which address;
  - the payer connects a testnet wallet, gets gas from `/api/facilitator/gas`, signs a
    `send_funds` to the owner, and the public facilitator settles it;
  - `POST /api/public/pay/:token/paid` reads the transaction back (the owner's balance went up by
    at least the amount) and marks the link paid, and the owner is notified.

## Consequences
- A split never moves the owner's money beyond what the Errand's Disc allows, and asking someone to
  pay never needs their account.
- Tokens are random and unlisted. Anyone with the link sees the name, amount and owner address,
  which is what a payment request is.

## Links
- `apps/server/src/runtime/splitter.ts`, `apps/web/src/features/public-remora/pay-link-page.tsx`.
