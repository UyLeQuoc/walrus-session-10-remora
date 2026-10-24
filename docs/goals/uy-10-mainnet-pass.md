# Goal U10: the mainnet pass: mainnet money, owned memory, Walrus Sites

- **Owner:** Uy's agent, with Uy at every mainnet transaction and every deploy step
- **Runs in:** the main checkout, on `main` (ADR-0022)
- **Depends on:** U9 ✅ (the testnet launch: the deployed URL, `/status`, evals). Uy calls this pass ([ADR-0059](../adr/0059-launch-on-testnet.md)).
- **Network:** this is the mainnet pass ADR-0024 deferred. Testnet stays the e2e network and the playground's.
- **Features:**
  - both Move packages on mainnet, with multisig `UpgradeCap`s;
  - `DEPLOYMENTS.mainnet`;
  - owned memory (ADR-0030);
  - the mainnet facilitator, merchants and Walrus publisher;
  - the deployed app switched to mainnet;
  - H6 Walrus Sites.

**Goal:** by Nov 6, a judge on the live URL runs the demo path with **mainnet** money. Uy can run it twice in a row without intervention.

> **U10 exit (mainnet, on the deployed URL, Playwright + Uy's wallet where a signature is needed):**
> 1. `diagnose` for mainnet (`cd apps/server && bun run diagnose mainnet`) passes against the production env. Health is `ok`, and `E2E_BASE_URL=<url> bun run e2e:main` is green.
> 2. **The demo path, twice in a row on mainnet:**
>    1. sign in, then Detect funds;
>    2. create a Scout with one signature, its owned-memory delegate registered onchain;
>    3. Scout buys `sui-risk` with real USDC (≤ 0.05 per payment) and answers with a Wake that `/verify` checks;
>    4. a Sentinel pings on a real transfer;
>    5. the injection is blocked;
>    6. a hatch.
>
>    Record the timings and digests.
> 3. At least 10 memories land in the **owner's own** Walrus Memory account (owned mode), counted from `listMemories`.
> 4. The Walrus Sites landing resolves, and the README links it, the live URL and the mainnet package ids.

## Before you start
- **Read:** ADR-0020, 0024, 0025, 0026, 0030, 0058, 0059; [deploy runbook](../deploy.md); [Move security](../../packages/move/SECURITY.md).
- **Needs from Uy.** Ask for each at the step that needs it:
  - the mainnet publisher key and its SUI (≈0.3);
  - the multisig members (Uy + a backup);
  - the mainnet sponsor key with SUI, `MERCHANT_PAYTO`, and `WALRUS_PUBLISHER_MAINNET` with WAL;
  - a demo owner wallet with ~$5 USDC (Uy signs; the agent never holds it);
  - a SuiNS name for the site, if he wants one;
  - the playground's mainnet decision (recommended: it stays on testnet).
- **Spending:** every mainnet transaction is shown to Uy (what it does, the amount, the signer) and waits for a yes. Payments cap at 0.05 USDC.

## Steps
1. **The allowance check on mainnet** (U1's mainnet step, ADR-0020): issue, a payment of ≤ 0.05 USDC, and a revoke, on a mainnet test owner Uy funds.
2. **Publish** `remora` and `remora_hatchery` from reviewed commits, then move both `UpgradeCap`s to the multisig in the same pass.
3. **Contract PR:** `DEPLOYMENTS.mainnet`.
4. **Owned memory (ADR-0030):**
   - a delegate per remora on the owner's account (sponsored `add_delegate_key`, one owner signature);
   - checked onchain before the remora activates;
   - the operator's memories stay readable.
5. **Mainnet services:**
   - the facilitator + gas station;
   - merchants with the mainnet `payTo`;
   - the Walrus mainnet publisher for the Hatchery.
6. **Deploy** the mainnet env (Uy runs it). Then run `diagnose` for mainnet, the health check and `e2e:main`.
7. **H6:**
   - Huấn builds the static landing and docs;
   - the agent wires `site-builder` (a CI job or a script);
   - Uy publishes to Walrus Sites (WAL) and, if he wants, points a SuiNS name at it.
8. **The exit** above, twice. Write `docs/spikes/2026-11-xx-u10-exit.md` and a handoff to Huấn. Swap the README and blog's **[mainnet]** markers for the real numbers.

## Done when
- [ ] Both packages are on mainnet, the `UpgradeCap`s are on the multisig, and `DEPLOYMENTS.mainnet` is merged.
- [ ] Owned memory works on mainnet, with ≥10 memories in the owner's account.
- [ ] The deployed app runs on mainnet: `diagnose`, health and `e2e:main` are green.
- [ ] The demo path ran twice in a row on mainnet. Testnet `bun run e2e`, typecheck, lint, test, `sui move test` and CI are green.
- [ ] Walrus Sites is live and linked.
- [ ] The ADRs, docs, README and a handoff are written; everything is pushed to `main`.

## Never
- Sign or send a mainnet transaction without Uy's yes for that transaction, or with a real owner's key.
- Deploy without Uy.
- Commit `.env`, keys or tokens, or print key values.
- Force-push.
- Kill processes on ports 8787/5173.
- Edit `reference/` or Huấn's branch.
- Rewrite an accepted ADR.
- Stream checkpoints unfiltered (ADR-0058).
