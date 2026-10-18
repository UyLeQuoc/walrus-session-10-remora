# ADR-0006: Reuse hippo as disclosed prior work; adopt its stack

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
hippo (Walrus Sessions 8, commit `66fb33a`) is the owner's own mainnet-tested Walrus Memory chatbot. It
already has the memory layer, channels, identity, web shell and ops scripts. The rules allow existing
projects only for new progress made inside the window.

## Decision
- On Oct 20, make **one labeled import commit** of hippo's shared libraries.
- Add a README section, "Built on prior work".
- Use hippo's stack:
  - Bun + Turbo;
  - a Hono server (API + channels + runtime);
  - a Vite + React SPA;
  - Drizzle + Neon.

## Consequences
- About 40 features get a head start.
- The pitch must lead with what's new: money rails, autonomy, Wake, Tatum, Hatchery.
- `reference/hippo` is a gitignored, read-only clone.

## Links
- [reuse-from-hippo.md](../reuse-from-hippo.md)
