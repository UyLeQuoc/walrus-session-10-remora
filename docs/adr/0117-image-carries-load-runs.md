# ADR-0117: The API image carries the dated load runs, so /stats can show them

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U17, during the deploy Uy approved in [ADR-0111](0111-scale-pass.md))

## Context
`/api/stats` (U17 D3) shows the latest dated load run, read from
`docs/spikes/<date>-u17-load.json`. The API's Docker image copies `packages/`, `apps/server`, the
facilitator and the merchants, but not `docs/`. On the first U17 deploy, production served the
database numbers with `loadRun: null`.

## Decision
- **The copy:** the Dockerfile copies `docs/spikes/*-u17-load.json` into the image, at the same
  relative path the server reads. The files are small and committed, and they're the record the
  numbers come from.
- **Nothing else changes.** If no run file is there, the page still shows only the database's
  numbers.

## Consequences
- **Redeploy for a new run:** a new load run reaches production with the next deploy.

## Links
- [ADR-0111](0111-scale-pass.md)
- [ADR-0099](0099-first-deploy-one-railway-service.md)
