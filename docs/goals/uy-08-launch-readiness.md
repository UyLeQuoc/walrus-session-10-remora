# Goal U8: launch readiness: a public playground, health and `diagnose`, the security docs, the README

- **Owner:** Uy's agent
- **Runs in:** the main checkout, on `main` (ADR-0022)
- **Depends on:** U7. The MVP ship set is otherwise built.
- **Network:** money on testnet ([ADR-0024](../adr/0024-testnet-first.md)); memory on the mainnet relayer ([ADR-0026](../adr/0026-network-switch.md)). The mainnet pass is a separate goal (U9) that Uy calls.
- **Features (the MVP ship set's remaining items, `docs/remora-features.md` §0):**
  - H7 public playground;
  - K1 observability;
  - K2 health dashboard + `diagnose`;
  - I6 Move security review;
  - I7 threat model;
  - L2 README & roadmap;
  - prep for L3 launch: a deploy runbook (no deploy), a blog draft, a demo-script dry run;
  - a live check of H1/A5 Telegram.

**Goal:** when judges arrive on Nov 9, everything they can touch works and explains itself.
- A signed-out visitor can **try Scout** in a sandbox whose worst case is $1, enforced onchain.
- Ops can see the system's health in one place, and `diagnose` blocks a bad deploy.
- The README, threat model and security notes make the claims checkable.

> **U8 exit (testnet, Playwright, a signed-out browser):**
> 1. **Playground.** A visitor with no wallet opens `/playground` and gets their own Scout with a **$1 Disc** funded by the playground wallet. It asks "Is package 0x2 safe to depend on?": Scout pays from that Disc and answers with a Wake that `/verify` checks.
>    - The session's question limit refuses one more question, in plain words.
>    - A second visitor gets their own Scout.
>    - The pool cap holds.
>    - The expiry job (TTL shortened for the test) revokes the Disc onchain and retires the remora.
> 2. **Health.** `/lab/health` and `GET /api/health/deep` show each item with its status: checkpoint lag, Tatum, the relayer and its budget, sponsor gas, the facilitator, queue depth and the watcher.
> 3. **`diagnose`.** `bun run diagnose` passes on testnet, and it fails, naming the problem, when a deployment id is wrong (an env override in the test).
> 4. **Docs.** README, threat model and Move security notes exist, and their links resolve (a link check runs in CI).

## Before you start
- Read:
  - `docs/remora-spec.md` §12.8 (playground) and §12.10 (ops);
  - `docs/remora-features.md` rows H7, K1, K2, I6, I7, L2, L3;
  - `docs/tech-reference.md` §1.11 (the relayer's limits);
  - ADR-0025 (Disc, `UpgradeCap`), ADR-0030 (memory mode), ADR-0048–0050 (relayer budget and timeouts).
- **The relayer budget is the hard constraint.** The operator account gets about 1000 weighted requests an hour, shared by every remora and the e2e suite, and the U7 exit hit it.
  - The playground must stay inside that budget even under load.
  - Propose in an ADR: memory for playground remoras either (a) in a separate MemWal account if `PLAYGROUND_MEMWAL_ACCOUNT_ID`/`_PRIVATE_KEY` are set, or (b) recall-only plus the Wake, with a per-hour cap on writes.
- **Ownership.** H7·ui is Huấn's. Check his branches, PRs, handoffs and commits, and claim `/playground` only if he hasn't started it (a note in `docs/handoffs`, ADR-0027). The lab pages are Uy's (team-split §6).
- **Needs in `.env`** (never commit them; ask me if one is missing):
  - `PLAYGROUND_FUNDER_KEY`: a testnet test key holding testnet USDC for the $1 Discs, plus a little SUI. The burner can fund it if I say so.
  - `TELEGRAM_BOT_TOKEN`: already set. Confirm with me that it's the test bot before the live check.

## Contract PR (one, first)
Each shape comes with a fixture:
- `PlaygroundSession`: remora id, Disc id, budget left, questions left, `expiresAt`, a verify link per answer.
- `PlaygroundLimits`: per session, per IP, the pool, the TTL.
- `HealthReport`: items `{ name, status: ok | degraded | down, detail, value?, threshold? }`, overall status, `checkedAt`.
- `DiagnoseReport`: the same shape as `HealthReport`, used by the CLI and `/api/health/deep`.

## Phase A: backend (each with tests)
1. **Playground (H7).**
   - `POST /api/playground/session` is public. It's rate-limited per IP and per guest session, and refuses when the pool is full.
   - It creates a Scout whose `$1` Disc is issued and funded by the playground wallet. The server signs; the spender is the remora's key; the payees are the Reef only. Then it starts live (not shadow), since the worst case is $1.
   - `POST /api/playground/:id/ask` is limited to N questions per session.
   - A `playground.expire` job revokes the Disc onchain after the TTL (24 h; shortened in tests), retires the remora and records the digest.
   - Pool cap: at most K live playground remoras; the funder's balance is checked first, with an alert when low.
   - Memory follows the ADR's choice. Playground remoras never touch owners' namespaces.
2. **Health + `diagnose` (K2).**
   - `GET /api/health/deep` reports:
     - the database;
     - Tatum gRPC latency;
     - checkpoint lag (the indexer cursor or the watcher's last checkpoint against the latest);
     - the relayer's `/health` and whether it's answering 429 (the budget);
     - sponsor gas balance against a threshold;
     - the facilitator's `/supported`;
     - job queue depth and oldest job;
     - watcher subscriptions;
     - the playground funder's balance.
   - `bun run diagnose` extends hippo's doctor. It checks:
     - every `DEPLOYMENTS` id exists onchain with the right Move type (Disc package and registry, hatchery package and registry);
     - the relayer's `/config` package;
     - the operator delegates;
     - the Tatum keys;
     - the Walrus publisher and aggregator.
     It exits non-zero on any failure and names the fix.
3. **Observability (K1).** Every request and job log carries a request or job id, and every remora turn logs its stage timings (recall, plan, pay, model, write). Errors are counted per route in a ring buffer that `/lab/health` shows (no external vendor).
4. **Telegram (H1, A5), live.** With the test bot, Uy links his chat from Settings and sends `/scout is 0x2 safe?`; record the reply, the Why? button and 👎. This needs Uy, so ask me when you get here. If I skip it, it stays unverified.

## Phase B: UI
- `/playground` (claim per above). A one-screen "Try Scout":
  - the $1 budget meter;
  - the questions left;
  - answers with Why?/verify;
  - when it expires;
  - a "Get your own" link to sign-in.
- `/lab/health`: the health report as a status board, with the recent errors.

## Phase C: docs and launch prep (no deploy)
- **I7** `docs/threat-model.md`:
  - assets and actors;
  - trust boundaries (owner wallet, remora keys, server, relayer, facilitator, merchants, models, templates, the playground);
  - each threat with its mitigation and the test, ADR or spike that proves it (prompt injection → Sonar and the Disc abort `7NYf3QGE…`; malicious templates → M7; sponsor drain; relayer plaintext; playground abuse).
- **I6** `packages/move/SECURITY.md`: the invariants, permit guards, version gates, the upgrade policy (multisig `UpgradeCap` at the mainnet pass) and the test list, for both packages.
- **L2** `README.md`:
  - the pitch;
  - an architecture diagram (mermaid);
  - "How Remora uses Walrus" and "How Remora uses Tatum". The list of Tatum gRPC calls is generated from the code by a script;
  - quick start, e2e, Built on prior work, and the roadmap of unbuilt features;
  - links to the threat model, the spikes and the ADRs.
- **Link check:** a script plus a CI step that fails on broken relative links in `docs/` and `README.md`.
- **Deploy runbook** `docs/deploy.md`:
  - services, env per service, build and start commands, health checks;
  - `diagnose` as the gate, and the rollback.
  - Config files may be added. **Don't deploy.**
- **L3 drafts:**
  - `docs/launch/blog-draft.md` ("Rails Before Robots, Part 2"), with real numbers from the spikes and the learning export;
  - a dry run of the demo script (`docs/remora-plan.md`) on testnet, with timings and the gaps found.

## Phase D: the U8 exit e2e (testnet)
- `e2e/tests/u8.spec.ts` covers the exit list above.
- Run it alone first. Run the full `bun run e2e` once, mindful of the relayer budget.
- Record timings and digests in `docs/spikes/2026-10-xx-u8-exit.md`.
- Write a handoff to Huấn.

## Done when
- [x] The contract PR is merged (PR #10).
- [x] A + B are done with tests; the C docs are written and link-checked.
- [x] `typecheck`, `lint`, `test`, `sui move test` and `bun run e2e` are green; CI is green. The full suite went **43/43** once the MemWal relayer recovered, and **43/43 again on Oct 24** after ADR-0058 with the new Tatum keys. It was 42/43 during the relayer's outage ([U8 exit](../spikes/2026-10-22-u8-exit.md), [ADR-0055](../adr/0055-memory-failures-in-health.md)).
- [x] The U8 exit passes on testnet, with timings and digests ([notes](../spikes/2026-10-22-u8-exit.md)).
- [x] The ADRs, docs and a handoff to Huấn are written; everything is pushed to `main`.
- [x] Telegram (H1, A5), **verified live** (Oct 24): link, `/remoras`, `/scout` with its answer, Why?, and 👎 recorded as `noise` ([U8 exit](../spikes/2026-10-22-u8-exit.md#telegram-h1-a5)).

## Never
- Mainnet money or a mainnet publish (that's U9, Uy's call).
- Deploying.
- Real owner accounts in tests: the burner, test keys and fresh test keypairs only.
- Committing `.env` or keys, or printing key values.
- Force-pushing.
- Killing processes on ports 8787/5173.
- Editing `reference/`.
- Rewriting an accepted ADR.
- Editing anything Huấn has started.
