# ADR-0129: The Subscriptions keeper reads the price first, and stops on a hike it doesn't remember

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 B2, [ADR-0119](0119-u18-learning-loop-everyday-money.md))

## Context
Recurring paid feeds are everyday money. A remora that pays them should notice when a merchant raises
its price, the way a person would, instead of paying whatever the 402 says up to its cap.

## Decision
- **A fifth kind, "Subscriptions keeper"** (`keeper`):
  - a daily schedule ("every day at 8am", started by its first subscription);
  - house services as its default payees. Community APIs and remoras on sale need the existing
    one-signature payee change.
- **Subscriptions** live in its config (`subscriptions: {id, ref, url, usual, failures}`).
  - Each is a listed Reef ref plus the exact URL it charges.
  - They change through `saveConfig`, so they're versions in the config history.
- **Each charge reads the 402 first** (`quote`), then:
  - **First charge:** it pays, and the price becomes the remembered one.
  - **Price 20% or more above the remembered one:**
    - it doesn't pay;
    - it records a `price_hike` event (in the feed, the statement's flags and the `price.hike`
      webhook);
    - it opens an approval (`payload.kind = "price_hike"`, within its limits) and notifies the
      owner.
    - The owner can pay once (the approval's yes; the remembered price stays), accept the new
      price (remembered, and the next charge pays it), or cancel the subscription.
  - **Otherwise:** it pays through the ordinary pay path (Sonar, the Disc, the Wake). The
    remembered price only falls on its own, so small rises can't creep it up past the 20% line.
- **The ADR-0109 guard** refuses a 402 that asks to be paid at another address. Three failed charges
  in a row notify the owner.
- **Memory:** every change to the remembered price is written to `feedback` as
  `PRICE <ref> · usually … USDC a charge · <why> · as_of …`.
- **Doors:** the remora page's Subscriptions card (subscribe, Run now, the hike's three choices),
  the approvals inbox, and the daily run's message on Telegram.
- `examples/sell-an-api`'s `PRICE` env lets a dated run raise a real merchant's price.

## Consequences
- A hike costs nothing until the owner decides, and every decision is a receipt or a remembered
  price.
- The remembered price is per subscription, not per merchant: two URLs on one merchant are watched
  separately.

## Links
- `apps/server/src/runtime/keeper.ts`, `apps/web/src/features/remoras/keeper-card.tsx`.
- [ADR-0121](0121-price-and-webhook-triggers-outbound-hooks.md), [ADR-0122](0122-statements-and-config-history.md).
