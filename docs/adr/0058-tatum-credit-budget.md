# ADR-0058: Spend Tatum credits deliberately: filtered streams only, background streams off by default, one health report per 30 s

- **Status:** Accepted
- **Date:** 2026-10-24
- **Deciders:** Uy (agent)
- **Supersedes:** the watcher-filter decision in ADR-0045 ("past 10, it subscribes without a filter")

## Context
On Oct 23 both Tatum keys (testnet and mainnet, one account) answered `402` to every call. Nothing on the server could read the chain, so `diagnose`, the e2e and the Telegram `/scout` check all stopped. The free plan has 1M credits a month at 3 requests a second ([Tatum plans](https://docs.tatum.io/docs/plans-limits)). Our unary calls come nowhere near that.

A probe on testnet on Oct 24, 30–45 s for each stream, measured the two kinds of checkpoint stream:

| Stream | Frames | What a frame carries |
|---|---|---|
| Unfiltered | about 4.2 a second, **about 15,000 an hour** | every checkpoint, with every transaction's balance changes: about 53 transactions a second, about 2.5 KB a frame |
| Filtered to 10 addresses | about one every 5 s, **about 720 an hour** | a cursor, and a checkpoint only when it matches |

ADR-0045 dropped the filter past 10 watched addresses, because a filter takes at most 10 literals. The e2e leaves its Sentinels in shadow mode: the local database had 13 on testnet. `WATCHER` and `INDEXER` also defaulted to `on`, and `.env.example` set them on. So **every local server, every e2e run and every teammate's dev server streamed every testnet checkpoint unfiltered for as long as it ran**. Tatum doesn't publish what a stream frame costs, but this is the only consumer large enough to spend a month's credits.

## Decision
- **The watcher never streams unfiltered.** The watched addresses are split into groups of at most 10, with one filtered stream per group (`groupsOf`, `filterFor`).
  - The streams share one cursor, so the first frame after a gap backfills it once.
  - One stream failing restarts them all after the backoff.
  - There are at most 5 streams per network (50 addresses). Past that, the watcher logs `watcher.capped` with how many addresses it dropped.
- **`WATCHER` and `INDEXER` default to `off`.** Only the one deployed instance that watches and indexes sets them `on` (`docs/deploy.md`). Locally, `WATCHER=on` is opt-in, for Sentinel work. The e2e config already sets them explicitly.
- **`/api/health/deep` is cached for 30 s,** with one report shared by all callers. A report costs several Tatum calls per network, and the public status page polls it from every open tab.
- **Usage is counted:**
  - `PacedTransport` counts Tatum requests per method (retries included) and stream frames (`tatumUsage()`);
  - the server logs `tatum.usage` every 10 minutes, so the next stream that spends credits shows up in a day, not a month.
- **The keys were replaced** on Oct 24 (new testnet and mainnet keys in `.env`, never committed).

## Consequences
- With 13 watched addresses, the watcher costs 2 filtered streams, about 1,440 cursor frames an hour, instead of about 15,000 full checkpoints.
- A server started with defaults spends nothing on streams.
- Past 50 watched addresses on one network, some aren't watched until a smarter split exists (by owner activity, or Sentinels' own budgets). The log says so.
- The e2e still leaves shadow Sentinels behind; with filtered streams they cost little. Retiring them at the end of a run is a follow-up for the e2e.

## Links
- ADR-0021 (gRPC only), ADR-0045 (the superseded watcher filter), ADR-0052 (health)
- `apps/server/src/triggers/watch.ts`, `apps/server/src/env/schema.ts`, `apps/server/src/routes/health.ts`, `packages/chain/src/paced.ts`, `.env.example`, [deploy runbook](../deploy.md)
