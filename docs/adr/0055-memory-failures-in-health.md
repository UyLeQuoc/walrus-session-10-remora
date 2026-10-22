# ADR-0055: Health and `diagnose` report memory failing behind a healthy relayer

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Uy (agent, goal U8)

## Context
During the U8 exit's full suite (Oct 22, about 04:10 UTC), the MemWal relayer kept answering `/health`, `/config` and its delegate and listing routes. Behind them, its memory pipeline was failing:
- recalls answered `500 Internal server error` (with a traceId);
- each write was accepted (`saved: true`), then its background job failed with `Embedding API error (401 Unauthorized): User not found` (the relayer's own embedding provider, not a key Remora sends);
- the read API listed no memory written after Oct 21 18:30 UTC.

Remora's replies went on without memory as designed (ADR-0049). But `/lab/health`, `diagnose` and the memory doctor all said ok, and the U7 exit timed out waiting for a rule's blob without saying why.

## Decision
- **Signals.** `noteRelayerError` keeps a 429 as the budget signal (ADR-0052), as before. It now also keeps every other relayer failure our own calls see:
  - a recall error or timeout;
  - a write timeout;
  - a write job that came back `failed`. The server's memory wrapper now hears `onWrite` failures and logs `memory.write_failed`.
- **Health.** A new item, **`memory writes`**: `degraded` when our calls saw any recall or write failure in the last 10 minutes. It shows the count and the newest error, traceId included. Like the budget item, it spends nothing on the relayer. It's `degraded`, not `down`, because replies still work.
- **`diagnose`.** A new check, **`memory recall`**: one recall in the probe namespace `remora:diagnose:probe`, costing one weighted request.
  - A 401 or 403 from the relayer is our key, so it's `down` and gates the deploy.
  - Any other failure is the relayer's own pipeline, so it's a warning (`degraded`): not deploying wouldn't fix it.
- **The e2e.** A suite that depends on relayer writes (U7's Proof of Learning) fails while the relayer can't embed. We record that failure, and don't mask or skip it.

## Consequences
- An operator sees a relayer outage on `/lab/health` within one failed call, and `diagnose` names it before a deploy.
- `diagnose` now spends one relayer request per run.
- Remora can't fix the outage itself; the fix text says to send the traceId to the MemWal team.

## Links
- ADR-0049 (memory never on the reply path), ADR-0050 (write timeout), ADR-0052 (health and `diagnose`)
- [U8 exit](../spikes/2026-10-22-u8-exit.md)
- `apps/server/src/ops/signals.ts`, `health.ts`, `diagnose.ts`; `apps/server/src/runtime/memory.ts`
