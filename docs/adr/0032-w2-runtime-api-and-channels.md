# ADR-0032: W2 runtime wiring, API and Telegram: who may act, and how

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Uy (agent, U5 Phase A)

## Context
U5 Phase A connects the remora runtime (Scout, Sentinel, Sonar, Wakes) to the real environment, the web API and Telegram. Several choices decide what a remora, an injected text, or a linked chat is allowed to do. They need to be explicit before the UI (Phase B) and the exit e2e (Phase C) build on them.

## Decision
**API (`apps/server/src/runtime/routes.ts`)**
- Every route answers for the signed-in wallet only, on the session's network header (ADR-0026). The one exception is `/api/verify/:ref` (G3), which is public like the chain it checks.
- Owner transactions come back unsigned. After the wallet executes one, a `/confirm` route reads the chain by digest before any state changes. This covers issue, pause, retire, budget (B7), rotate (B9) and panic (N10).
- Errors are `{ error: { code, message } }`. When copy has a no-blank sentence for the code, the message is that sentence (N6).
- Ids must be UUIDs, otherwise 404, never a database error.

**What the model may do (D4)**
- It gets `pay`, `tatum.balances`, `tatum.objects`, `web.fetch`, `memory.recall`, `schedule` and `handoff`.
- It has no `memory.remember`. Memory writes are deterministic (Wakes, rules, source scores), so injected text can't plant memories.
- `schedule` only creates an approval. The owner sets schedules directly.
- `handoff` queues a question to another of the owner's Scouts and never pays on its own.
- Tool output from outside (paid data, pages, objects) goes back wrapped as untrusted.

**Schedules (D1, N12)**
- Five-field cron in UTC, parsed from phrases such as "weekdays at 8am" or "every Sunday evening". Anything unknown is refused, not guessed.
- Each run is a D2 job. It queues the next slot from its own slot, so the idempotency key never repeats.
- Removing a schedule ends its chain at the next run.

**Models (D9)**
- `LLM_MODEL` answers.
- Sonar's check and rule parsing use `LLM_SMALL_MODEL`. If it isn't set they use `LLM_FALLBACK_MODEL`, then `LLM_MODEL`.
- The daily token cap per remora is `REMORA_DAILY_TOKENS`.

**Telegram (H1, A5)**
- **Linking:** the dashboard issues the existing `/link` code (identity/link.ts) as a deep link, `t.me/<bot>?start=link_<code>`. The wallet session already proves the owner signed in with the wallet, so linking needs no second signature. Redeeming folds the Telegram identity into the wallet's person. A chat that already has hippo memories is refused, as before.
- **Commands:**
  - `/remoras`, `/scout`, `/teach`, `/budget` and `/approvals` act for the linked wallet, and so does addressing a remora by name ("Scout, …").
  - `/pause` acts directly on a Disc-less remora.
  - Anything that needs the owner's signature (a Disc pause, panic, an approval payment) answers with a dashboard link. The bot never holds the owner's keys.
- **Buttons:** 👍/👎 call `giveFeedback` (N19). "Why?" shows the Wake's reason and digest (N4).
- **Notices:** Telegram only accepts public https URL buttons, so local dashboard links are dropped from the keyboard.
- One `Bot` per process sends notices even with `CHANNELS=off`.

**First run (N13)**
- Scout's first question is a paid risk check on the Disc package itself.
- Sentinel's first message shows the balances of what it watches and how to teach it. "Explain your last 5 transactions" needs an address-history index, which gRPC doesn't offer. Our watcher only sees events from creation on, so that part moves to W3.

**F6 index check**
- "What we wrote" per namespace comes from our own tables: one Wake per `receipts` row and one rule per `sentinel_rules` row.
- It is compared with the relayer's `stats`. A shortfall is a warning in the inspector, never a `restore()`.

## Consequences
- The UI can build every W2 screen on these routes. The inbox pays with the owner's wallet (ADR-0031) and approves schedules with a plain yes.
- New env:
  - `MERCHANTS_URL[_TESTNET]` and `MERCHANT_PAYTO[_TESTNET]` (the Reef);
  - `LLM_SMALL_MODEL`;
  - `REMORA_DAILY_TOKENS`;
  - `WATCHER`;
  - `TELEGRAM_BOT_USERNAME`.
- The `approvals.kind` enum gains `schedule`. It is a text column, so no migration is needed.

## Links
- `apps/server/src/runtime/{routes,index,schedules}.ts`, `apps/server/src/channels/{remora-bot,telegram,telegram-bot}.ts`, `apps/server/src/tools/{read,propose}.ts`, `apps/server/scripts/verify.ts`
- ADR-0026 (network switch), ADR-0030 (W2 memory mode), ADR-0031 (owner payments)
