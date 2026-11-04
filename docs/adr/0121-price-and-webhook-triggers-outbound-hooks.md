# ADR-0121: Price and webhook triggers, and outbound webhooks, without new tables

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 C4, C5)

## Context
Goal U18 ([ADR-0119](0119-u18-learning-loop-everyday-money.md)) asks for two parts:
- **C4:** the `price` and `webhook` kinds that `Trigger` has had since the MVP, but the runtime never
  handled.
- **C5:** outbound webhooks for `payment.settled`, `approval.asked`, `answer.ready`, `proposal.made`
  and `price.hike`.

What the code and the goal's rules gave us:
- **No schema push:** new data goes in existing columns. `remora_events` rows reach the web feed, which
  parses `type` against `FEED_TYPES`, so a new event type there breaks the feed.
- **The jobs queue** (D2) already dedupes by idempotency key, backs off and dead-letters.
- **The price source:** the house `price` merchant reads CoinGecko's free API. The server can't import
  `apps/merchants`.
- **The per-address gate** allows 30 requests a minute and 200 an hour per IP. GitHub delivers every
  customer's webhooks from a few shared addresses.
- **Payments, answers and approvals** are written from about ten places (pay, approvals, threads,
  crews, MCP), and other U18 parts add proposals (A1) and price hikes (B2) in parallel.

## Decision
- **Price source:** `pricesOf`, `TOKENS` and `symbolsIn` move to `@remora/merchant` (`prices.ts`). The
  merchant re-exports them unchanged; the server reads them unpaid.
- **Price trigger** (`config.triggers`, kind `price`, with an `id`):
  - a `remora.price_poll` job runs on each 5-minute slot. It queues the next slot first, so a failed
    poll never ends the chain, and it isn't retried. The chain ends when no remora has a price
    trigger; startup, a new trigger and a resumed one queue the next slot again. A slot is queued
    once;
  - one CoinGecko read per poll covers every live trigger;
  - each trigger's side (`above`, `below` or `inside`) is kept in `config.priceState[id]`, written with
    `jsonb_set` on that key only;
  - **hysteresis:** a crossing fires once. The trigger re-arms only after the price comes back past the
    threshold by 1%. The first reading only records the side, so adding a trigger never wakes the
    remora at once;
  - a crossing queues one `remora.price_wake` job, keyed by the side it left. A poll that runs twice
    wakes once.
- **Webhook trigger** (`config.triggers`, kind `webhook`, with an `id` and an optional `name`):
  - `POST /api/hooks/:remoraId/:id`, with no session;
  - **signature:** `X-Remora-Signature: sha256=<hex HMAC-SHA256(body)>`. GitHub's
    `X-Hub-Signature-256` has the same format and is accepted, so a GitHub webhook works as it is;
  - **the secret is derived, never stored:** HMAC-SHA256 of `SESSION_SECRET` and
    `remora.hook.in:<remoraId>:<id>`. The owner reveals it on the remora's page. Rotating gives the hook
    a new `id`, so the old URL and secret stop at once. Changing `SESSION_SECRET` rotates every hook;
  - **order of checks:** the signature first (it needs no lookup, so an unsigned caller learns nothing
    about which remoras exist), then 404 for an unknown remora or id, then 30 a minute per hook (429).
    A body over 64 KB gets a 413. A GitHub `ping` gets a 200 and no wake;
  - **the per-address gate** skips `POST /api/hooks/*`. A bad signature still counts against the
    caller's address, so a flood of unsigned requests is cut off after 30 a minute;
  - **the turn:** the body is queued as a `remora.hook_wake` job, keyed by `X-GitHub-Delivery` when
    present, so a redelivery wakes once. The question is written by us. The body reaches the model
    only as `<untrusted source="webhook github (push)">` data (ADR-0110). The one thing lifted from the
    body is a GitHub repository link matching `https://github.com/<owner>/<repo>` exactly, so a Repo
    Reviewer checks the repo it was told about, through the usual pay path (Sonar, ADR-0109, the
    Disc).
- **Wakes:**
  - both triggers run the remora's usual turn (`scoutAsk`, as a schedule does), and the owner gets
    the answer;
  - the answer event's payload says what woke it (`wokenBy`);
  - only Researchers and Briefers wake this way;
  - a paused or retired remora, or a removed or paused trigger, ends the job quietly.
- **Outbound webhooks** (`config.hooks.out`, at most 5 URLs, each with its events):
  - **delivery:** a `remora.hook_deliver` job per event and URL, 8 attempts with the queue's backoff,
    then dead;
  - **body:** `{id, type, remoraId, createdAt, data}`;
  - **signature:** `Remora-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>`. The secret
    is derived from `SESSION_SECRET`, the remora's id and `config.hooks.key`. Rotating writes a new
    key. **Receivers reject a `t` more than 5 minutes from now;** `verifyHookSignature` in
    `runtime/hooks-out.ts` is the reference;
  - **SSRF:** https only in production; http only to localhost, and only when not in production. Every
    resolved address must be public (`isPrivateAddress`), checked when the URL is added and again
    before every send. No redirects, 5 s timeout. A refused URL is logged and not retried. As in
    `safe-fetch` (ADR-0031), DNS can still change between the lookup and the send;
  - **log:** the last 20 attempts (status, code, ms, attempt) in `config.hookLog`, trimmed in one SQL
    statement. They don't go in `remora_events`, which would break the feed;
  - **Send test:** one signed delivery now, logged with the rest.
- **One scanner emits every event.** Rather than a call at each of the ten write sites:
  - every 5 s, it reads new `remora_events` (`payment` with a digest, `answer`, `price_hike` or
    `price.hike`) and new `approvals` rows of remoras that have outbound hooks, and queues deliveries;
  - an approval with `kind: "budget_change"` or `payload.kind: "proposal"` is `proposal.made`; every
    other approval is `approval.asked`;
  - the row's id is the delivery's id and its job key, so a row is delivered once per URL. Each pass
    re-reads 30 s behind the last, so a late commit isn't missed;
  - `emitHook(deps, remora, type, data, {id?, at?})` is exported for anything that isn't such a row.
- **Team files** get optional `triggers` (`TeamTrigger`):
  - price triggers arrive paused, like schedules (ADR-0042), and webhooks get fresh ids;
  - an export carries no ids;
  - the Repo reviewer template gets a GitHub webhook, and the Token desk's analyst gets "SUI below
    0.85" (SUI was 0.937 on CoinGecko on Nov 5).
- **Schema** (optional fields only): `Trigger.price.id` and `.paused`, `Trigger.webhook.name`,
  `RemoraConfig.hooks.out` (`OutHook`), `HOOK_EVENTS`, and `TeamRemora.triggers`.

## Consequences
- **Easier:**
  - an owner can wake a remora from GitHub, an alert system or a price;
  - other apps hear about its payments, with the real digest;
  - A1 and B2 get webhooks for their rows without calling anything.
- **Harder or open:**
  - the scanner runs in every API process. Today that's one replica; with more, the job keys still
    deliver each event once;
  - a hook's events can lag the row by up to about 5 s;
  - an owner who points `answer.ready` at the same remora's inbound webhook builds a loop. The
    per-hook limit and the daily token cap bound it;
  - a crew lead woken by a webhook hands the question to its members without the body;
  - the live gallery still has the old Repo reviewer and Token desk until they're published again.
- **Docs:** the remora page's Hooks card explains the signature and the 5-minute tolerance. The goal's
  exit note and `docs/remora-features.md` (D1, J3) are updated in Part D.

## Links
- [ADR-0119](0119-u18-learning-loop-everyday-money.md), [Goal U18](../goals/uy-18-learning-loop.md)
  (C4, C5)
- [ADR-0110](0110-live-attack-bait-and-switch.md) (untrusted input), [ADR-0109](0109-pay-only-at-listed-address.md),
  [ADR-0042](0042-grok-bots-shape.md) (team files; imports arrive paused), [ADR-0031](0031-e4-owner-payment-and-merchants.md)
- Code: `apps/server/src/triggers/{price,webhook}.ts`,
  `apps/server/src/runtime/{hooks,hooks-out,hooks-routes}.ts`, `packages/merchant/src/prices.ts`,
  `apps/web/src/features/remoras/hooks-card.tsx`
