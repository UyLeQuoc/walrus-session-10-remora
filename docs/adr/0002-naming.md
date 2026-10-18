# ADR-0002: Product and component names

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
We wanted names in the Sui stack style (Walrus, Seal, Nautilus), checked for collisions in the AI-agent
and crypto space. Cuttle, Beluga and Dolphin are close to existing projects.

## Decision
- **Remora:** the product. Each agent is a remora: *it rides with you everywhere and never steers*.
- **Disc:** the onchain spending policy (the remora's suction disc).
- **Wake:** the receipt for each action.
- **Sonar:** the pre-action check.
- **Reef:** the x402 service directory.
- **Hatchery:** template sharing.

## Consequences
- Code identifiers follow these names: `remora::disc`, `DISC`, `@remora/*`.
- The names also anchor the story in the demo and blog: "it goes wherever you go, it cleans up after you,
  it never takes the wheel".
