# ADR-0125: The Errand pays people: contacts are Disc payees, paid through the same x402 path

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 B1, [ADR-0119](0119-u18-learning-loop-everyday-money.md))

## Context
Remoras paid only services. "Everyday money" needs a remora that pays a friend, under the same rules
a service payment follows:
- a limit Sui enforces;
- only listed payees, at their listed address (ADR-0109);
- a receipt anyone can check.

The Disc already pays any address in its payee set (`disc::pay`). The pay pipeline (Sonar, the Disc,
the Wake anchored as `Paid.intent`, the facilitator's sponsored settle) is built around an x402 402,
though.

## Decision
- **A fourth kind, "Errand"** (`errand`):
  - triggered by a message;
  - default budget 5 USDC a month and 1 USDC a payment;
  - namespaces `me`, `feedback` and `receipts`.
- **Contacts:**
  - a contact is `{name, address, ref}` in the remora's config (`RemoraConfig.contacts`, an
    optional field);
  - its ref is `reef:contact-<slug>`, so it fits `ReefRef` and the existing payee list;
  - creating an Errand needs at least one contact;
  - changing the list is one owner signature (`disc::set_payees`, `contactsTx` and
    `confirmContacts`), and the confirm checks the chain.
- **Contacts are listed like services.** `listedFor` adds them to the Reef for the ADR-0109 guard,
  Sonar's policy, `payeeAddresses` and `issueArgs`. An Errand never pays anyone else, and never at
  another address.
- **The same pay path, with an in-process merchant:**
  - `contactFetch` answers `contact://<slug>/pay` with `@remora/merchant`'s own x402 middleware;
    its 402 asks for the amount at the contact's address, Disc-aware;
  - `requestPayment` and `payWithDisc` then run unchanged: Sonar, the Disc, the facilitator's
    sponsored gas, verify and settle, the Wake and its anchor;
  - the memo is the Wake's reason, so its hash is `Paid.intent` onchain.
- **Over the cap:** Sonar's "ask" makes an approval. The owner pays the contact once from their own
  wallet, and the server sends the signed transaction and checks the balance change.
- **Unusual amounts:**
  - at 3x the median of a contact's last ten payments, or more, it asks first (an approval with
    `viaDisc: true`);
  - the owner's yes lets the Errand pay from its Disc.
- **Memory:** each payment writes `CONTACT <name> · paid … for … · usually … ·
  as_of …` to `me`.
- **Words:** "pay Linh 2 USDC for lunch", "send $0.5 to Huy for the taxi" and "trả Linh 2 USDC
  tiền ăn trưa" are parsed by a pattern, never guessed by a model. Anything else gets a hint and the
  contact list.
- **Doors:** the remora page's "Pay someone" card, `/api/remoras/:id/ask`, Telegram's
  `Errand, pay …` and `/pay …`.

## Consequences
- People and services share one guard, one cap and one receipt format; a contact can't be swapped
  for another address without the owner's signature.
- The facilitator settles contact payments too, so they count toward its per-payTo daily cap.
- A contact's name becomes part of a public `ReefRef` slug inside the Wake (not onchain: only the
  intent hash is). Names stay in the owner's config.

## Links
- `apps/server/src/money/contacts.ts`, `apps/server/src/runtime/errand.ts`,
  `apps/web/src/features/remoras/errand-card.tsx`.
- [ADR-0109](0109-pay-only-at-listed-address.md), [ADR-0111](0111-scale-pass.md) (`settle`
  modes in `@remora/merchant`).
