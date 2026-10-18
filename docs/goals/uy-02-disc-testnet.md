# Goal U2: The real Disc + disc-sdk, on testnet (E1, I6, G2, E2 builders)

**Owner:** Uy Le · **Runs in:** the main checkout, on `main` (ADR-0022). The Move work goes through a
PR, as always · **Depends on:** U1 (GO, [ADR-0020](../adr/0020-allowance-spike-go.md)), PR #1 (the
stub, merged or used as the base) · **Network:** testnet only ([ADR-0024](../adr/0024-testnet-first.md))

**Goal:** turn the U1 stub into the real `remora::disc` from spec §6, publish it to **testnet**, and give
the backend a typed `@remora/disc-sdk` to issue, pay, rotate, pause, change payees and change budgets.
Every flow is proven on testnet through Tatum.

## Read first
- `docs/remora-spec.md` §6 (Disc, updated by ADR-0020), §10 (safety), §12.1, §12.3
- `docs/spikes/2026-10-21-allowance.md`: every gotcha (`issue` returns no ID, the OTW, test funding, gas
  coin merge, Tatum 429)
- `docs/adr/0003`, `0020`, `0023`, `0024`; `docs/tech-reference.md` §3.1–3.3
- The code: `packages/move/remora` (stub, PR #1), `packages/chain`, `spikes/allowance/flow.ts`

## Allowed paths
`packages/move/remora/**`, `packages/disc-sdk/**`, `packages/chain/**`, `spikes/disc/**` (new e2e
scripts), `docs/spikes/**`, `docs/tech-reference.md`, `docs/adr/**`. `packages/schema` changes only
through a **contract PR** (`DEPLOYMENTS.testnet`, plus any new Disc types).

## Steps
1. **`remora::disc` (E1)** in the shape of spec §6:
   - `Registry` (shared) with a `Table<DiscKey, ID>`, where `DiscKey { owner, name }` is unique;
   - one shared `Disc` per allowance, holding `owner, name, payees: VecSet<address>, per_payment_cap,
     paused, version`;
   - `issue<C>(registry, proposal, payees, per_payment_cap)`: refuses a taken key, creates the Disc, and
     calls `allowance::issue` with `settings_permit`;
   - `pay<C>(disc, allowance, withdrawal, payee, intent: vector<u8>, clock)`: checks the key matches,
     `!paused`, payee allowed, `app_balance_spend`, the per-payment cap and `send_funds`. It emits
     **`Paid { disc, payee, amount, intent, ts_ms }`** (G2: `intent` is 32 bytes, so assert the
     length);
   - owner-only `rotate` (`rotate_spender` via `settings_permit`), `set_payees`, `pause`, and `revoke`
     (it frees the key and deletes the Disc);
   - **permit guards (I6):** every path that mints a permit checks `ctx.sender() == disc.owner` or is
     `pay` itself. Add a `version` check on every entry point. Use clever `#[error]` constants.
2. **Move tests:**
   - every path, plus the negative ones: not the owner, paused, wrong key, bad intent length, and every
     U1 case;
   - **invariant tests:** a Disc never pays a non-allowlisted payee or above its cap, and only the owner
     can reconfigure;
   - budget change = **revoke + reissue in one owner PTB** (test the Move side).
3. **Publish to testnet** with the spike keys (ADR-0024 allows it). Record the package ID, the
   `Registry` ID and the `UpgradeCap` holder. Open a **contract PR** for `DEPLOYMENTS.testnet`
   (+ `discRegistryId`).
4. **`@remora/disc-sdk` (E2 builders):** typed PTB builders on `@remora/chain`:
   - `issue`, `pay` (allowance withdrawal + sponsor-ready: sender = remora, gas owner = sponsor),
     `rotate`, `pause`, `setPayees`, `revokeAndReissue` (one PTB);
   - readers: get a Disc, list an owner's Discs (from their `AllowanceCap`s), and the funds split
     (`readFunds`);
   - errors are mapped from clever errors to typed codes for the "Why?" drawer;
   - vitest unit tests on the builders.
5. **Testnet e2e (`spikes/disc/`):** with testnet USDC:
   - issue → pay with an intent → read the `Paid` event back by digest (`LedgerService.GetTransaction`);
   - rotate, then the old key fails and the new one pays;
   - pause, then pay fails;
   - `revokeAndReissue` with a new budget;
   - every negative case is simulate-only.

   Record the digests in `docs/spikes/2026-10-xx-disc-testnet.md`.
6. **Docs:** spec §6 if the shape changed, tech-reference §3, and an ADR for any decision. The upgrade
   policy (`UpgradeCap` → multisig later) gets a note or an ADR.

## Done when
- [ ] `sui move test` is green, with invariant tests; the PR is open with CI green
- [ ] The package is published on testnet; the IDs are in a contract PR
- [ ] `@remora/disc-sdk` builders and readers have unit tests; typecheck, lint and test are green
- [ ] The testnet e2e passes through Tatum, with digests recorded, `Paid.intent` read back, and every
      negative case aborting with a known code
- [ ] Docs and ADRs are updated; pushed to `main`, apart from the Move PR

## Never
- Touch mainnet (no transactions, no publish). That's the mainnet pass, Uy's call (ADR-0024).
- Commit keys or `.env`.
- Change `packages/schema` outside a contract PR.
- Build the facilitator or `disc.fetch` here. Those are the next goal (E3, D8).
