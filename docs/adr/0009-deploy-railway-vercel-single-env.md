# ADR-0009: Backend on Railway, frontend on Vercel, one environment: main

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
It's a small team with a short window. The owner wants the simplest possible deploy surface.

## Decision
- The backend services (server, facilitator, Reef, merchants) run on **Railway**, auto-deployed from
  `main` after CI, with **one server replica** (Telegram long-polling).
- `apps/web` runs on **Vercel**; PR previews call the main API.
- Walrus Sites is a mirror.
- Neon `main` is the only database. Local dev uses Docker Postgres.
- **There's no staging.**

## Consequences
Without staging, we rely on discipline:

- merge windows;
- feature flags;
- additive-only schema;
- E2E on `main` after each window, with revert-or-fix;
- a demo freeze from Nov 6 21:00.

Huấn tests only with test accounts and the capped E2E burner.

## Links
- [remora-spec.md §5](../remora-spec.md#5-architecture) · [team-split.md §8](../team-split.md#8-environments)
