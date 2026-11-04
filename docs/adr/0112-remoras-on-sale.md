# ADR-0112: How a remora sells its answers (E11)

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U17, [ADR-0111](0111-scale-pass.md))

## Context
ADR-0111 asks for remoras that sell their answers to other owners' remoras over x402. Each sale
should leave a chain of receipts, and it must not loop or leak. The U17 spec wrote listings as
`remora:<slug>`. Three things in the existing code shape the design:
- `ReefRef` in `packages/schema` only accepts `reef:<slug>`. Wakes, Disc payees, Hatchery payees and
  playground receipts all use it.
- `FEED_TYPES` (also a shared contract) has no "sale".
- A remora's own memories can hold its owner's private notes.

## Decision
- **The listing:**
  - A remora on sale is listed as **`reef:remora-<slug>`** rather than `remora:<slug>`. It fits
    `ReefRef`, so Wakes, Sonar, the Disc's payees, the ADR-0109 listed-address check and the budget
    flows work unchanged.
  - Its name is "@slug". The Reef directory shows it under "Remoras", with
    `kind: "remora"`.
  - `ReefService.kind` and `.description` are new, optional fields: an additive contract change.
- **Where it lives:** the sale lives in the remora's `config.sell` (`on`, `slug`, `price` of
  0.005–0.05 USDC, `blurb`), so there's no schema push. The server caches the listings, refreshes
  them every 30 s, and refreshes them on every change.
- **The endpoint:** `GET /api/x402/r/:slug?q=` is paid at the **owner's address** and settles after
  the answer (`settle: "after"`, ADR-0111).
  - The unpaid call does no work.
  - A failed or late answer (45 s) returns 5xx and is never settled.
- **A sold turn:**
  - reads only the remora's `sources` and `feedback` memories, never `me`;
  - has the chain read tools only (no web fetch, schedules or handoffs);
  - can't buy another remora's answer (depth 1).

  Wakes keep only hashes of the buyer's question, so the question never reaches Walrus Memory. The
  seller's DB thread shows the answer it sold.
- **No loops, no self-dealing:** the pay path refuses:
  - `sale.depth`: a remora payee inside a sold turn;
  - `sale.self`: a remora payee paid at its own owner's address. An owner's remoras hand questions
    over for free instead.
- **Recording:**
  - The sale is recorded in the seller's feed as an `action` with `kind: "sale"` and the buyer's
    digest, so `FEED_TYPES` stays as it is.
  - The buyer's payment event carries `upstream`: what the seller paid for that answer, with
    digests. The thread shows it as "→ it paid …".
- **Buying:**
  - The planner reads "ask @slug …" (or "@slug") as "hand this whole question to that remora". It
    buys nothing else for it.
  - An owner lets a remora pay a seller with one signature: `disc::set_payees` through
    `buildSetPayees`, by `POST /api/remoras/:id/payees` and `/confirm`.
- **Dependency:** `@remora/merchant` moves from the server's devDependencies to its dependencies.
  It's our own workspace package, not a new dependency.

## Consequences
- **No contract or schema push** beyond the two optional `ReefService` fields.
- **Gas:** a sale needs two sponsored transactions at once (the seller's source, then the buyer's
  payment). The testnet sponsor was split into 29 gas coins first (U17 D1).
- **A seller that stops selling:** a buyer that still lists it in its payees can't renew its budget
  until it drops that payee (`reef.unknown_payee`).
- **Payer:** the facilitator reports the payer, and the seller refuses its own owner as a payer as a
  backstop.

## Links
- [ADR-0111](0111-scale-pass.md)
- [ADR-0109](0109-pay-only-at-listed-address.md)
- [Goal U17](../goals/uy-17-scale.md)
