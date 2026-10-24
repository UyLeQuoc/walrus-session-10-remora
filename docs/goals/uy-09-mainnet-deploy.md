# Goal U9: the mainnet pass and the first deploy: Remora live at a public URL, with mainnet money and memory

- **Owner:** Uy's agent, with Uy at every mainnet transaction and every deploy step
- **Runs in:** the main checkout, on `main` (ADR-0022)
- **Depends on:** U8 ✅ (playground, health, `diagnose`, docs, a Tatum budget per ADR-0058)
- **Network:** this is the mainnet pass ADR-0024 deferred. Testnet stays the e2e network.
- **Features:**
  - the mainnet pass: both Move packages, `DEPLOYMENTS.mainnet`, owned memory (ADR-0030), the mainnet facilitator and Walrus publisher;
  - the first deploy (API + runtime, facilitator, merchants, web);
  - H6 Walrus Sites (Huấn builds it, Uy publishes it);
  - N20's public `/status` route;
  - Huấn's W3 web batch (PR #11) and his backend requests, triaged;
  - the Tatum follow-ups from ADR-0058.

**Goal:** by Nov 6 (W3 exit), a judge opens a public URL on mainnet, signs in, and runs the demo path. Uy can run it **twice in a row without intervention**. Testnet keeps the playground and the e2e.

> **U9 exit (mainnet, on the deployed URL, Playwright + Uy's wallet where a signature is needed):**
> 1. **Deployed.**
>    - `diagnose` for mainnet (`cd apps/server && bun run diagnose mainnet`) passes against the production env.
>    - `GET /api/health/deep` shows every item `ok` (or `degraded` with a reason).
>    - `E2E_BASE_URL=<url> bun run e2e:main` (the smoke project) is green.
> 2. **The demo path, twice in a row on mainnet:**
>    1. sign in, then Detect funds;
>    2. create a Scout with one signature, its owned-memory delegate registered onchain;
>    3. Scout buys `sui-risk` with real USDC (≤ 0.05 per payment) and answers with a Wake that `/verify` checks;
>    4. a Sentinel pings on a real transfer;
>    5. the injection is blocked by Sonar;
>    6. a remora is hatched from the Hatchery.
>
>    Record the timings and digests for both runs.
> 3. **Memory on mainnet.** At least 10 memories are written to Walrus Memory on mainnet in the owner's own account (owned mode), counted from `listMemories`.
> 4. **Public pieces:**
>    - `/status` is reachable signed out and shows names and statuses only;
>    - the Walrus Sites landing resolves;
>    - the README links the live URL and the mainnet package ids.

## Before you start
- **Read:**
  - ADR-0024 (testnet first, mainnet pass), ADR-0025 (`UpgradeCap`), ADR-0026 (networks), ADR-0030 (owned memory);
  - ADR-0051 (playground), ADR-0052/0055/0058 (health, `diagnose`, the Tatum budget);
  - [deploy runbook](../deploy.md), [Move security](../../packages/move/SECURITY.md), the submission checklist in `docs/remora-plan.md`.
- **Needs from Uy.** Ask for each at the step that needs it, never before:
  - the **mainnet publisher key** and its SUI (two packages, ≈0.3 SUI). The publish is Uy's transaction.
  - the **multisig** members for both `UpgradeCap`s (Uy + a backup key).
  - **mainnet keys** in `.env`, never committed:
    - the facilitator's `SPONSOR_PRIVATE_KEY`, with SUI for gas;
    - `MERCHANT_PAYTO` for the merchants;
    - a Walrus mainnet publisher with WAL (`WALRUS_PUBLISHER_MAINNET`).
  - a **demo owner wallet** with ~$5 USDC and a little SUI. Uy signs in it; the agent never holds it.
  - **deploy access:** Railway (API, facilitator, merchants, Postgres) and Vercel (web), on Uy's machine, logged in by Uy.
  - the **playground's mainnet decision:** stay testnet-only (recommended), or a mainnet funder with a budget.
  - **rotated secrets**: Tatum keys and the bot token were pasted in chat on Oct 24. Uy rotates them and puts the new ones in `.env`.
  - **testnet SUI** for the burner and the gas station (faucet), before the e2e.
- **Spending:** every mainnet transaction is shown to Uy (what it does, the amount, the signer) and waits for a yes. Payments cap at 0.05 USDC each. The agent never signs a mainnet transaction with a real owner's key.

## Phase 0: clear the queue (first, a day at most)
1. **Huấn's PR #11 (W3 web batch 1).**
   - Review it: run web tests, check the e2e's test ids and labels (`u8.spec.ts`), run `--project=smoke --project=mobile` on testnet.
   - If it's green, Uy merges it. If not, comment on the PR and stop that part.
2. **`/status` (N20) contract PR.**
   - One line in `routes.tsx` for Huấn's page.
   - A public `GET /api/status` that returns `{ name, status }[]` and the overall status only. No `detail`, `fix`, `value` or errors, because `/api/health/deep` names balances and traceIds.
   - Both approve. The page reads `/api/status`.
3. **Reply to Huấn** in `docs/handoffs/` with yes/no and dates for his 13 backend requests. Uy confirms the triage first. Recommended:
   - **Yes for W3:** N15 cost card, E7 Reef directory (`GET /api/reef/services`), G6 public proof links.
   - **Yes if time allows:** A8 account export/exit.
   - **No (roadmap):** F7 import, N11 config versions, B5 SuiNS, B2, N16, F10, N8. H3 Mini App and J4 docs site are roadmap too.
   - Give him the `MERCHANT_PAYTO_TESTNET` the e2e derives.
4. **Tatum follow-ups (ADR-0058):**
   - the e2e retires the Sentinels it creates (or pauses them in the database) when it finishes, so watched addresses don't pile up;
   - a re-subscribe because the watched set changed doesn't backfill;
   - health shows `tatum.usage` for the last hour.

## Phase A: the mainnet pass (Uy signs)
1. **The allowance check on mainnet** (U1's mainnet step, ADR-0020): one Disc issue, a payment of ≤ 0.05 USDC and a revoke, with the burner logic on a mainnet test owner Uy funds.
2. **Publish** `remora` and `remora_hatchery` from reviewed commits, then move both `UpgradeCap`s to the multisig in the same pass.
3. **Contract PR:** `DEPLOYMENTS.mainnet` (packages, registries, Walrus endpoints).
4. **Owned memory (ADR-0030):**
   - each new remora gets its own delegate key on the owner's Walrus Memory account (sponsored `add_delegate_key`, one owner signature, folded into the create flow if the wallet allows);
   - the runtime checks onchain that the delegate is registered before it activates the remora;
   - operator-account memories stay readable (`alsoRead`).
5. **Mainnet services:**
   - the facilitator + gas station with the mainnet sponsor;
   - merchants with the mainnet `payTo`;
   - the Walrus mainnet publisher for the Hatchery.
6. `diagnose` for mainnet (`cd apps/server && bun run diagnose mainnet`) passes locally against the mainnet env.

## Phase B: deploy (Uy runs the deploy commands; the agent prepares and verifies)
- Follow `docs/deploy.md`:
  1. `main` is green;
  2. the schema is pushed by Uy;
  3. `diagnose` passes with the production env;
  4. facilitator → merchants → API → web;
  5. health is checked;
  6. `e2e:main` runs.
- `WORKER`, `WATCHER` and `INDEXER` are `on` on exactly one API instance (ADR-0058). Set Vercel's Node to 24 (ADR-0056).
- **H6:** Huấn builds the static landing and docs. Uy publishes them to Walrus Sites, and the URL goes into the README.
- Any change to the deploy runbook goes in the same commit as the ADR that decides it.

## Phase C: the U9 exit
- Run the exit above twice on mainnet.
- Record timings, digests, memory counts and the Tatum usage in `docs/spikes/2026-11-xx-u9-exit.md`.
- Write a handoff to Huấn with the live URL, what's mainnet now, and which of his requests landed.

## Done when
- [ ] PR #11 is reviewed and merged (or sent back with reasons), and the `/status` contract PR is merged.
- [ ] Huấn's requests have answers. The ones accepted for W3 are done, with tests.
- [ ] Both packages are on mainnet, the `UpgradeCap`s are on the multisig, and `DEPLOYMENTS.mainnet` is merged.
- [ ] Owned memory works on mainnet, with ≥10 memories in the owner's account.
- [ ] Deployed: `diagnose mainnet` passes, health is ok, `e2e:main` is green, and `/status` and the Walrus Sites landing are public.
- [ ] The demo path ran twice in a row on mainnet. Testnet `bun run e2e`, typecheck, lint, test, `sui move test` and CI are green.
- [ ] The ADRs, docs, README and a handoff are written; everything is pushed to `main`.

## Never
- Sign or send a mainnet transaction without Uy's yes for that transaction, or with a real owner's key.
- Deploy without Uy running or approving that step.
- Commit `.env`, keys or tokens, or print key values.
- Force-push.
- Kill processes on ports 8787/5173.
- Edit `reference/`.
- Rewrite an accepted ADR.
- Edit Huấn's branch (comment on the PR instead).
- Stream checkpoints unfiltered (ADR-0058).
