# ADR-0052: One health report, `diagnose` as the deploy gate, request ids and an error ring

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Uy (agent, goal U8)

## Context
Spec §12.10 asks for a health dashboard and a `diagnose` that gates deploys. Before U8:
- `/api/health/deep` checked only the database and the relayer;
- `bun run diagnose` was hippo's memory doctor, which knew nothing of the Disc, the hatchery or the facilitator;
- logs had no request id, so a slow Scout turn (ADR-0049) couldn't be traced through its stages.

## Decision
- **One shape** (`HealthReport`, `DiagnoseReport` in `packages/schema`). Every item has a status (`ok`, `degraded`, `down`), what was measured, the threshold, and the fix when it isn't ok. The overall status is the worst item.
- **`GET /api/health/deep`** (public; no addresses, keys or ids) reports:
  - the database;
  - Tatum gRPC (a cheap call, with its latency);
  - checkpoint lag, measured from the watcher's last checkpoint (or the indexer's cursor) against the tip;
  - the relayer's `/health`;
  - the relayer budget: the last 429 *our own calls* saw, so health never spends budget to check it;
  - sponsor gas;
  - the facilitator's `/supported`;
  - job queue depth and the age of the oldest due job;
  - watcher subscriptions;
  - the playground funder's balances.
  - `/lab/health` shows it as a status board, with the recent errors.
- **`bun run diagnose`** keeps hippo's memory doctor and adds the Remora checks:
  - every `DEPLOYMENTS` id exists onchain with its expected Move type (Disc package and `disc::Registry`, hatchery package and `hatchery::Registry`);
  - the Tatum keys answer;
  - the Walrus publisher and aggregator answer;
  - the facilitator, when one is configured.
  - It exits non-zero when any item is down, naming the fix.
  - `REMORA_DEPLOYMENTS_OVERRIDE`, read only by `diagnose`, lets a test prove that it fails on a wrong id.
- **Observability (K1):**
  - every request gets an id, taken from `x-request-id` or made, and echoed back;
  - every log line written while serving it carries the id, through async context; jobs carry their job id the same way;
  - a remora turn logs its stage timings (`recall`, `plan`, `pay`, `model`, `write`);
  - errors are counted per route in an in-memory ring (the last 100, grouped by route and code) that health reports;
  - no external vendor.

## Consequences
- An operator sees one report, and a deploy runbook can say: run `diagnose`, and don't ship if it fails.
- Health never spends the relayer budget to measure it.

## Links
- spec §12.10; ADR-0021 (gRPC only), ADR-0049; `docs/deploy.md`
