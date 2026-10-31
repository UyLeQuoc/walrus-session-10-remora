# ADR-0084: Enter Best Use of Agent Payments, the revealed Mystery Bounty

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (written by Uy's agent)

## Context
- **The Mystery Bounty has been announced.** The rules on the submission site (checked Oct 31) now list
  **"Best Use of Agent Payments — $500"**: the best app across the three tracks that integrates agent
  payments using x402 or MPP, with payments settled on Sui.
  - [event-rules.md](../event-rules.md) still said "watch Discord".
  - [docs/README](../README.md) listed only Track 2 and Best Walrus Memory as the prizes we target.
- **Remora already does what the prize describes.**
  - Scout pays Reef services over x402 through our own `exact` facilitator for Sui
    ([ADR-0003](0003-spending-limits-native-allowances.md), `apps/facilitator`).
  - The facilitator sponsors gas and settles on Sui. Every payment is capped by the Disc.
  - MPP is on the roadmap (E12). The prize accepts either protocol.
- **The form has no field for a track or a prize.** Judges learn what we enter from the project
  description.
- **Payments settle on Sui testnet** ([ADR-0059](0059-launch-on-testnet.md)). The prize doesn't say
  which network.

## Decision
- **Target three prizes:**
  - Track 2, Smart Agents for Real Life;
  - Best Walrus Memory;
  - Best Use of Agent Payments.
- **Name x402 on Sui wherever a judge looks:**
  - the README's opening;
  - the blog's Reef paragraph;
  - the project description in the [submission draft](../launch/submission-draft.md).
- **Say which network.** Payments are on testnet and memory is on mainnet. Nothing claims mainnet
  payments.
- **The mainnet pass (U10) stays Uy's call.** If a mainnet x402 payment does land, the prize gains one
  explorer link. The submission doesn't depend on it.

## Consequences
- **One more prize can be won** at no extra build cost.
- **The demo's first beat already is the proof:** Scout pays 0.01 USDC over x402 from its Disc, and the
  receipt checks out onchain.
- **The trade-off is weaker evidence:** the payments shown are testnet payments.
- **U10 (the mainnet pass) gets one more reason to run.** It needs:
  - the Disc published on mainnet (ADR-0024: Uy only);
  - mainnet USDC.

## Links
- [event-rules.md](../event-rules.md) §8.2 · [ADR-0003](0003-spending-limits-native-allowances.md) ·
  [ADR-0059](0059-launch-on-testnet.md) · [ADR-0081](0081-launch-story.md)
