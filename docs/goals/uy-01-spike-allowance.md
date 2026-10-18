# Goal U1: Spike, address balances + app-bound Allowances via Tatum (go/no-go, Tue Oct 21)

**Owner:** Uy Le · **Runs in:** the main checkout, on `main` (no worktree, ADR-0022) · **Depends on:** U0
(bootstrap) merged.

**Goal:** prove, or disprove, the money rails before building on them. The outcome is **ADR-0020**:
either go with native app-bound allowances, or fall back to a `Coin` escrow (ADR-0003).

## Read first
- `docs/tech-reference.md` §3.1–3.3 (allowances, x402, gas) and §2.2 (Tatum Sui RPC/gRPC)
- `docs/remora-spec.md` §6 (Disc), §12.1 (funds model), §12.3 (sponsor)
- `docs/adr/0003`, `0004`, `0015`
- Live docs: https://docs.sui.io/onchain-finance/allowances/using-allowances,
  https://docs.sui.io/onchain-finance/asset-custody/address-balances

## Allowed paths
`spikes/allowance/**` (new, throwaway), `packages/chain/**` (a seed Tatum client you may keep),
`packages/move/remora/**` (a stub module only), `docs/spikes/**`, `docs/tech-reference.md`, `docs/adr/**`.

## Steps
1. **Versions:**
   - record the latest `@mysten/sui` (`npm view @mysten/sui version`), and confirm that its types
     expose `tx.withdrawal` / `tx.balance` and the allowance helpers;
   - record the Sui CLI version and confirm the framework has `sui::allowance`, `propose_for_app`,
     `issue`, `app_balance_spend` and the permits.
2. **Seed `packages/chain`:** a typed Tatum client, **gRPC only** (ADR-0021): native transport for Node, `x-api-key` metadata, retries.
   **Find which call exposes the address-balance component** separately from coin objects, comparing
   `StateService.GetBalance` / `ListBalances` fields against the coins from `ListOwnedObjects`.
3. **Testnet first** (check that allowances are enabled there; if not, go to step 4 with extra care):
   1. Move test USDC (or SUI) from `Coin` → the address balance with `coin::send_funds`. **Measure the
      settlement delay** until it's spendable.
   2. Write a stub Move module in `packages/move/remora` with `public struct DISC has drop {}`, plus
      `issue` and `spend` that call the app-bound allowance APIs with permits. Add a payee allowlist and
      a per-payment cap check (a minimal Disc).
   3. Owner: `propose_for_app` + `issue`. Spender (a **different** keypair): `tx.withdrawal({ from:
      'allowance' })` → stub `spend` → `balance::send_funds(payee)`, with **sponsored gas** (the sponsor
      key signs). Dry-run through Tatum, then execute through Tatum.
   4. Negative cases: over the cap, a payee not on the allowlist, before start / after expiry, and after
      `revoke`. Record the abort codes. Every one must fail.
4. **Mainnet:** prepare a script with tiny amounts (≤ 0.10 USDC). **Ask Uy before every mainnet
   transaction**, including publishing the stub package, then record the digests.
5. **Write up:**
   - `docs/spikes/2026-10-21-allowance.md`: versions, digests, settlement delay, the address-balance
     read method, abort codes, gotchas;
   - corrections to `docs/tech-reference.md` §3 for anything verified differently;
   - **ADR-0020** (go/no-go, which client calls to use, and any spec changes), plus updates to
     remora-spec §6 / §12.1 if the design changes.

## Done when
- [ ] The positive flow passes on testnet (and on mainnet, with Uy's approval), with digests recorded
- [ ] Every negative case aborts with a known code
- [ ] The address-balance read method and the settlement delay are documented
- [ ] ADR-0020 is written and indexed, and the docs are updated in the same commit
- [ ] Typecheck, lint, test and `sui move test` are green; pushed to `main`, with a PR for the Move
      stub (Move changes always get a PR)

## Never
- Spend more than 0.10 USDC per mainnet transaction.
- Make any mainnet transaction without Uy's explicit OK.
- Commit keys (read them from env).
- Build product features here: this is a throwaway spike, and the real Disc comes in E1.
