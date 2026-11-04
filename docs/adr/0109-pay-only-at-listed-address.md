# ADR-0109: A model may buy a listed service only at its listed address

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Uy's agent (goal U16)

## Context
The Researcher's model has a `pay` tool (payee and URL), next to the deterministic planner. During
the U16 capture, a plain question ("What does a Sui upgrade cap do?") made the model call `pay` with
made-up URLs under a listed payee:
- `https://tatum.io/sui/upgrade-cap`;
- `https://www.google.com/search?q=…`;
- `https://api.fomocharts.com/…`.

The pay path fetched each one, found no 402, and recorded a "didn't go through" line in the thread.
Nothing was paid, because Sonar and the Disc still guard any payment. But the server fetched
addresses the model invented, and a free answer looked like a failed purchase.

## Decision
- **The check:** at the start of the pay path, before anything is fetched, a payment is refused
  with Sonar's code (`sonar.blocked`) and recorded with its reason when:
  - its payee isn't a listed service ("reef:evil isn't a listed service"); or
  - its URL isn't the listed service's own address (`atListedAddress` in `money/reef.ts`). That
    means the same origin, and the listed path up to its first `:param`, or the exact path when
    there's none.
- **Why it's recorded:** a refusal is evidence. An injection can name a listed payee with its own
  URL, and Why? should show the attempt.
- **The model is told the addresses:** the Researcher's prompt lists the only paid services and their
  addresses, and says to answer without paying when none helps. That's what stops it inventing URLs
  in the first place.
- **Tests of the onchain layer** still run: with Sonar forced off, this check is off too, and the Disc
  must stop the payment.

## Consequences
- **Fewer fetches:** the server no longer fetches model-invented URLs.
- **Answers:** a model that still tries one gets a recorded refusal with a reason anyone can read, not
  a vague "didn't go through".
- **Tests:** `runtime.test.ts` covers "the model may buy a listed service only at its listed
  address", and "Sonar blocks the injected payment", which is now stopped here, before any fetch.

## Links
- [ADR-0106](0106-wow-pass-more-uses.md)
- [ADR-0110](0110-live-attack-bait-and-switch.md)
