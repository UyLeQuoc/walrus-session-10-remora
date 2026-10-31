# ADR-0078: Sentinel hands a suspicious event to Scout (D5)

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (written by Uy's agent)

## Context
- **Demo beat 4** ([remora-plan.md](../remora-plan.md)) and U9 Phase B ask for an automatic handoff.
  - Sentinel pings about an airdrop.
  - It hands the airdrop to Scout, which buys a `sui-risk` check.
  - It runs once per event, only for the owner's own remoras, and Scout's answer cites the ping's Wake.
- **The pieces already exist.** A remora can already hand a question to another by name (D4,
  `tools/propose.ts`), as a `remora.ask` job with a `handoff` trigger. Sentinel's rules could only ignore
  or ping.

## Decision
- **A third rule action, `check`.** It pings, then hands the event to Scout.
  - The phrase parser reads "check", "verify", "investigate", "ask Scout" and "have Scout".
  - The model path uses the same schema.
- **A new condition, `unknownCoin`.** It matches any coin but SUI and USDC.
  - It comes from "airdrop", or from "unknown", "new", "random" or "strange" coins or tokens.
  - "Airdrop" also implies incoming.
  - Example: "check airdrops with Scout" becomes `{ action: "check", when: { direction: "in",
    unknownCoin: true } }`.
- **On a `check` ping from an active Sentinel,** it queues a `remora.ask` for the owner's newest live
  Scout (active or shadow, not a playground one, same network).
  - **Question:** "Is <coin package> safe to depend on? <Sentinel> saw this on a watched address: …".
    Scout's planner buys a `sui-risk` report on the package.
  - **SUI's own package (0x2)** gets a plain question instead.
  - **Trigger:** `{ kind: "handoff", ref: "wake:<ping receipt id>" }`. It's inside the intent hash, so
    Scout's Wake cites the ping's Wake.
  - **Once per event:** the idempotency key is `auto-handoff:<sentinel>:<digest>`. A `handoff` event goes
    on Sentinel's feed.
- **A shadow Sentinel doesn't hand off:** shadow has no side effects. Scout pays only under its own
  Disc, so its limits, Sonar and approvals all apply as usual.

## Consequences
- **Demo beat 4 runs from one rule.** No second step is needed.
- **The rule shape is wider.** `SentinelRule` gains `check` and `unknownCoin`.
  - It lives on the server, not in `packages/schema`.
  - The web reads rules loosely (`text`, `id`), so nothing breaks there.
  - The remora page's hint text could mention "check airdrops with Scout" (Huấn's copy).
- **Each matched event can cost a `sui-risk` purchase** (0.01 USDC), inside Scout's Disc.

## Links
- [U9 goal](../goals/uy-09-testnet-launch.md) Phase B · [ADR-0042](0042-grok-bots-shape.md) (handoffs) ·
  `apps/server/src/runtime/rules.ts`, `apps/server/src/runtime/sentinel.ts`
