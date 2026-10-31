# Goal U9: the testnet launch: a public URL, Huấn's W3 queue, red-team evals (the license is done: MIT, ADR-0068)

- **Owner:** Uy's agent, with Uy at every deploy step
- **Runs in:** the main checkout, on `main` (ADR-0022)
- **Depends on:** U8 ✅
- **Network:** testnet for money; memory on the mainnet relayer, as always (ADR-0026). The mainnet pass is U10 ([ADR-0059](../adr/0059-launch-on-testnet.md)).
- **Features:**
  - the first deploy, on testnet;
  - N20 `/status`;
  - Huấn's W3 web batch (PR #11) and the backend items accepted for him;
  - D5 Sentinel → Scout handoff (demo beat 4);
  - I3 red-team evals;
  - the launch docs (the license is done: MIT, [ADR-0068](../adr/0068-mit-license.md));
  - the Tatum follow-ups from ADR-0058.

**Goal:** judges open a public URL and everything they touch works on testnet:
- the playground;
- sign-in and one-signature remoras;
- paid answers they can verify;
- Sentinel handing a suspicious transfer to Scout;
- a published "N attacks, 0 overspends".

> **U9 exit (testnet, on the deployed URL):**
> 1. **Deployed.**
>    - `diagnose` (testnet) passes against the production env.
>    - `GET /api/health/deep` shows every item `ok` (or `degraded` with a reason).
>    - `E2E_BASE_URL=<url> bun run e2e:main` is green.
>    - `/status` is public and shows names and statuses only.
> 2. **The demo path, twice in a row on the deployed URL, without intervention.** Use Playwright with a testnet test wallet, plus Uy for anything that needs a real phone or account:
>    1. sign in, then Detect funds;
>    2. create a team with one signature;
>    3. Scout's paid `sui-risk` answer, which `/verify` checks;
>    4. a Sentinel ping on a transfer is **handed to Scout automatically**, and Scout answers with a paid check;
>    5. the injection is blocked by Sonar;
>    6. rotate the remora key from the web;
>    7. the Proof of Learning view;
>    8. a hatch from the Hatchery;
>    9. `/scout` on the deployed Telegram bot.
> 3. **Playground.** A signed-out visitor on the deployed URL gets a $1-Disc Scout and a verified paid answer.
> 4. **Evals.** `bun run evals` runs at least 20 injection attacks and reports "N attacks, 0 overspends". Each attack is caught at its layer: Sonar, the gas station's simulation, or the Disc onchain. The result is published in the README and the threat model, and CI runs the deterministic part.
> 5. **Huấn.** PR #11 is merged. The backend items accepted for him are done, with tests, and his pages use them.

## Before you start
- **Read:**
  - ADR-0051, 0052, 0055, 0056, 0058, 0059;
  - [deploy runbook](../deploy.md), [threat model](../threat-model.md), [U8 exit + demo dry run](../spikes/2026-10-22-u8-exit.md);
  - Huấn's handoffs of Oct 23 (`docs/handoffs/2026-10-23-huan-to-uy-*`).
- **Needs from Uy.** Ask for each at the step that needs it:
  - **rotated secrets:** the Tatum keys and the bot token were pasted in chat on Oct 24. New ones go in `.env` and in the deploy's env, never committed.
  - **testnet SUI** (faucet) for the burner, the gas station and the playground funder.
  - a **dedicated testnet key for the deployed playground** (recommended), so the public app and the e2e don't share the burner. Or his OK to use the burner.
  - **Railway** (API, facilitator, merchants, Postgres) and **Vercel** (web), logged in on his machine.
  - confirmation of the **triage of Huấn's 13 requests** (below).
  - ~~the **license**~~: done Oct 25, MIT ([ADR-0068](../adr/0068-mit-license.md)).
  - optionally an **Enoki key** for zkLogin. Without it, sign-in on the deployed app is wallet-only.

## Phase 0: clear the queue
1. **PR #11 (Huấn, W3 web batch 1).**
   - Review it: web tests, the e2e's test ids and labels (`u8.spec.ts`), `--project=smoke --project=mobile` on testnet.
   - Uy merges if green; otherwise comment on the PR.
2. **`/status` (N20), one contract PR:**
   - a `routes.tsx` line for Huấn's page;
   - a public `GET /api/status`: `{ status, items: { name, status }[] }` from the cached health report. No detail, fix, value or errors, because `/api/health/deep` names balances and traceIds.
3. **Answer Huấn** in `docs/handoffs/`, once Uy confirms:
   - **Yes for U9:** N15 cost card, E7 Reef directory, G6 public proof links.
   - **Yes if time allows:** A8 account export and exit.
   - **Roadmap:** F7, N11, B5, B2, N16, F10, N8, H3, J4. H6 goes to U10.
   - Give him the `MERCHANT_PAYTO_TESTNET` the e2e derives.

## Phase A: the backend for Huấn's accepted items (one contract PR, then each with tests)
- **N15 `GET /api/remoras/:id/cost?month=YYYY-MM`:** `{ llmUsdc, gasUsdc, purchasesUsdc }`, built from recorded turns, sponsored gas and payments only.
- **E7 `GET /api/reef/services`:** `{ name, category, priceUsdc, payTo, docsUrl }[]` from the Reef registry.
- **G6** `POST /api/wakes/:id/share` returns a public token, and `GET /api/public/wakes/:token` returns a redacted Wake with its verify checks, no auth. Sharing is the owner's choice, and the owner can revoke it.
- **A8** (if time allows): `GET /api/account/export` (memories + Wakes, one JSON), and `POST /api/account/retire` (prepares one transaction that retires every remora).

## Phase B: the demo gaps and the Tatum follow-ups
1. **D5 Sentinel → Scout handoff.**
   - A Sentinel ping that its rules mark as "check" (for example an incoming transfer from an unknown sender over a threshold) queues a handoff to the owner's Scout: "Is <sender/package> risky?".
   - Scout answers under its own Disc, and the answer cites the ping's Wake.
   - It runs once per event, and only for the owner's own remoras. It shows in the room and in Telegram.
2. **Tatum (ADR-0058):**
   - the e2e retires or pauses the Sentinels it creates;
   - a re-subscribe because the watched set changed doesn't backfill;
   - health shows `tatum.usage` for the last hour.

## Phase C: the red-team evals (I3)
- `bun run evals` (in `apps/server` or a new `evals/` workspace) loads at least 20 attacks from a fixture file:
  - injected instructions in paid data and in web pages;
  - payees that aren't in the Reef;
  - amounts over the cap;
  - a lookalike `payTo`;
  - prompt-only "the owner said so";
  - poisoned templates.
- For each attack, record:
  - the layer that stopped it: Sonar, the gas station's simulation, or the Disc's abort onchain (testnet, a capped burner Disc);
  - the money that moved: it must be 0.
- The deterministic layers run in CI. The model and onchain layers run on demand, with the results written to `docs/spikes/` and summarised in the README and the threat model.

## Phase D: deploy on testnet (Uy runs the deploy steps; the agent prepares and verifies)
- **Follow `docs/deploy.md`:**
  1. `main` is green;
  2. Uy pushes the schema to the production database;
  3. `diagnose` passes with the production env;
  4. facilitator → merchants → API → web;
  5. health is checked;
  6. `e2e:main` runs.
- **One API instance runs the background work:** `WORKER=on`, `WATCHER=on`, `INDEXER=on`, and `CHANNELS=on` with the Telegram bot. That instance is the bot's only poller, so local runs use `CHANNELS=off` or another bot.
- **Web:** Vercel on Node 24 (ADR-0056), with `VITE_API_URL` and `CORS_ORIGIN` / `WEB_BASE_URL` matching.
- **Playground:** on, with its own funder and limits for the public (`PLAYGROUND_*`).
- **Any deploy decision** (hosts, regions, env) gets an ADR, and the runbook is updated in the same commit.

## Phase E: launch docs
- **`LICENSE`:** done Oct 25, MIT, with the README's License section ([ADR-0068](../adr/0068-mit-license.md)).
- **README:**
  - the live URL;
  - "money on testnet, memory on mainnet" stated plainly;
  - the eval result;
  - the `/status` link.
- **Blog draft:** testnet numbers from this exit. The **[mainnet]** markers stay for U10.
- **Demo script:** update `docs/remora-plan.md`'s beats to what this exit ran (beat 4 handoff, beat 6 rotate in the web, beat 9 playground).
- **Start dogfooding** on the deployed app: Uy's Sentinel on his own testnet addresses, for the Day-14 proof.

## Phase F: the U9 exit
- Run the exit above.
- Write `docs/spikes/2026-10-xx-u9-exit.md`: timings, digests, the eval table, the Tatum usage.
- Write a handoff to Huấn: the live URL, what landed from his requests, the test ids.

## Done when
- [ ] PR #11 is merged (or sent back with reasons), and the `/status` contract PR is merged. (PR #11 is merged; the contract PR is #17, open.)
- [x] Huấn's accepted items are done, with tests, and his requests have written answers (ADR-0076; contract PR #17 waits on his approval).
- [x] The D5 handoff and the Tatum follow-ups are done, with tests (ADR-0078, ADR-0080; the e2e Sentinel cleanup is handed to Huấn).
- [x] `bun run evals` reports N ≥ 20 attacks, 0 overspends, with each layer named. It's published, and its deterministic part runs in CI (28 attacks, ADR-0079).
- [ ] Deployed on testnet: `diagnose`, health, `e2e:main` and `/status` are green, and the playground is public.
- [ ] The demo path ran twice in a row on the deployed URL. `bun run e2e`, typecheck, lint, test, `sui move test` and CI are green.
- [x] `LICENSE` (MIT, ADR-0068).
- [x] README, blog, demo script, the ADRs and the handoff are written; everything is pushed to `main` (ADR-0081). The testnet numbers come with the exit.

## Never
- Mainnet money or a mainnet publish (that's U10, Uy's call).
- Deploy without Uy running or approving that step.
- Commit `.env`, keys or tokens, or print key values.
- Force-push.
- Kill processes on ports 8787/5173.
- Edit `reference/` or Huấn's branch (comment on the PR instead).
- Rewrite an accepted ADR.
- Stream checkpoints unfiltered (ADR-0058).
- Run two Telegram pollers on one token.
