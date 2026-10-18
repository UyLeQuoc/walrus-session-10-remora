# Spike U1: address balances + app-bound allowances via Tatum gRPC

- **Goal:** [uy-01-spike-allowance.md](../goals/uy-01-spike-allowance.md) · **Decision:** ADR-0020 (written
  when the on-chain runs are done)
- **Status:** in progress. Steps 1–2, the Move stub and a full **localnet** dry run (§6) are done. The
  testnet (Tatum) and mainnet runs wait for funding: the faucet API returns "CI compatibility is
  disabled", so the owner key has to be funded by hand.
- **Code:** `packages/chain` (seed client), `packages/move/remora` (stub `disc`), `spikes/allowance`
  (`probe.ts`, `flow.ts`, which also takes `localnet`)

## 1. Versions (Oct 18, 2026)

| Thing | Version | Notes |
|---|---|---|
| `@mysten/sui` | 2.33.2 installed, 2.36.0 latest | 2.33.2 already has `tx.withdrawal({ from: 'allowance', allowance, funder })`, `tx.balance` / `tx.coin` with allowances, and `Balance.addressBalance` / `coinBalance` |
| Sui CLI | **1.82.1** (testnet), was 1.74.0 | **1.74's framework has no `sui::allowance`** (`unbound module`). Installed 1.82.1 with `suiup install sui@testnet`. CI pins `testnet-v1.82.1` |
| Fullnodes behind Tatum | testnet `sui-node/1.82.1`, mainnet `sui-node/1.81.1` | from `LedgerService.GetServiceInfo` |
| Protocol | testnet **139**, mainnet **138** | |

Feature flags read through Tatum (`getProtocolConfig`), the same on both networks unless noted:

- `enable_allowances=true`, `enable_accumulators=true`, `enable_object_funds_withdraw=true`
- `enable_address_balance_gas_payments=true`: gas can be paid from an address balance
- `check_object_funds_withdraw_in_execution`: testnet `true`, mainnet `false`

## 2. Tatum gRPC from Node

- `SuiGrpcClient` takes `{ network, transport }`. Pass a `GrpcTransport` from
  `@protobuf-ts/grpc-transport` (+ `@grpc/grpc-js`) with `host: "sui-<net>-grpc.gateway.tatum.io:443"`,
  `ChannelCredentials.createSsl()` and `meta: { "x-api-key": key }`. That's
  `createTatumSuiClient` in `packages/chain/src/tatum.ts`.
- It works on both networks. `GetServiceInfo` latency from Vietnam: 1.2–2.5 s on the first call (TLS +
  channel setup).
- Retries (`withRetry`): only for `UNAVAILABLE`, `DEADLINE_EXCEEDED`, `RESOURCE_EXHAUSTED` and `ABORTED`.
  Don't blindly retry `ExecuteTransaction`; look the digest up first.

## 3. Reading the address-balance part

**`StateService.GetBalance` returns the split directly.** The `Balance` message has `balance` (total),
`address_balance` and `coin_balance`. The SDK maps them to `client.core.getBalance(...).balance.{balance,
addressBalance, coinBalance}`, and `ListBalances` does the same per coin type. There's no need to sum the
coins from `ListOwnedObjects`. That's `readFunds` in `packages/chain/src/funds.ts`, and it's what the
Detect funds button (A4) reads.

## 4. Allowance API as shipped (framework at `sui` 1.82)

Read from `sui-framework/sources/allowance.move`:

- `propose_for_app<T, A>(name, spender, lifetime_cap: Option<u256>, start_ms: Option<u64>, expiry_ms:
  Option<u64>, rate_limit: Option<RateLimit>, ctx): AllowanceProposal<T>` is **`entry`, not `public`**.
  A PTB can call it and pass the proposal on, but Move code can't (except in tests). Owners always
  propose from their own transaction.
- `issue<T, A>(proposal, SettingsPermit<A>, ctx)` shares the `Allowance<T>` and sends a soulbound
  `AllowanceCap<T>` to the funder. **It returns nothing, so the app never learns the new allowance's
  ID** inside the transaction.
- `app_balance_spend<C, A>(&mut Allowance<Balance<C>>, SpendPermit<A>, AllowanceWithdrawal<Balance<C>>,
  &Clock, ctx): Balance<C>`. The amount is the withdrawal's limit. Checks: sender == spender,
  start ≤ now < expiry, lifetime cap, rate limit.
- `revoke<T>(cap, allowance)` takes the shared allowance **by value** and deletes both.
- `rotate_spender<T, A>(&mut Allowance<T>, SettingsPermit<A>, new_spender)` is app-only.
- `AllowanceWithdrawal.is_sponsor` is always false today (`ESponsorWithdrawalNotEnabled`). The *funds*
  can't come from the gas sponsor, but the gas can (to be confirmed on testnet).
- Abort constants (clever errors) include `ENotSpender`, `EWrongApp`, `EExpired`, `ENotStarted`,
  `EExceedsLifetimeCap`, `EExceedsRateLimit`, `ENoLimit`, `ENoExpiration` and `EWrongAllowance`.

## 5. The stub Disc (`packages/move/remora/sources/disc.move`)

- `DISC` is named after the module, so it's also the module's **one-time witness**: `init` has to take
  it.
- **Policy binding:** since `issue` doesn't return the ID, policies (payee allowlist, per-payment cap)
  live in a shared `Registry` table keyed by the allowance's `(funder, name)`. `disc::issue` refuses a
  key that's taken, and every DISC-bound allowance has to pass through `disc::issue`, so the mapping is
  one to one. `disc::revoke` frees the key. E1 should keep this or pick something else on purpose
  (e.g. a second owner transaction that binds the policy with the `AllowanceCap`, which holds the ID).
- `pay` reads the registry immutably, so payments don't contend on it. Only issue and revoke write it.

`sui move test`: 9/9 pass. They cover the positive path (three payments, then checking that the payee
has +1000 and the funder −1000 settled), payee not allowed, over the per-payment cap, over the lifetime
cap, before start, after expiry, not the spender, a duplicate policy key, and revoke freeing the key.

**Test gotcha:** `test_scenario` settles accumulator writes when a transaction ends. If the funder has no
settled funds, ending the transaction after `send_funds` aborts with code 11 in `test_scenario`. Fund
the funder first with `balance::create_for_testing<T>(n).send_funds(funder)`.

## 6. Localnet dry run (Oct 18: full flow, local `sui start` 1.82.1 node, native gRPC)

This is the same `flow.ts` against a local node (`127.0.0.1:9000`, insecure grpc-js transport) instead of
Tatum. It proves the PTBs and the abort behaviour before any testnet SUI is spent.

| Step | Result | Digest (localnet, throwaway) |
|---|---|---|
| deposit 0.05 SUI `Coin` → address balance (`coin::send_funds`) | ok. **Address balance readable 1.7 s after submit**, on the first poll after `waitForTransaction` | `A2qpnr27…` |
| publish stub | ok | `CY9XKabH…` |
| owner `propose_for_app<Balance<SUI>, DISC>` → `disc::issue`, **one PTB** | ok. The `entry` result passes into the next command | `7KWTD1LL…` |
| spender `tx.withdrawal({ from: 'allowance' })` → `disc::pay`, **gas sponsored**, spender holds 0 SUI | ok. Payee address balance +1,000,000 | `5pB7zQiF…` |
| revoke (`disc::revoke` → `allowance::revoke`) | ok | `E9P6hy69…` |

Negative cases. Every one failed, and all of them failed **before execution** (at build/simulate), so no
gas was charged:

| Case | Where it stops | Error |
|---|---|---|
| Over the per-payment cap | `disc::pay` | `EOverPaymentCap` (abort 4) |
| Payee not on the allowlist | `disc::pay` | `EPayeeNotAllowed` (abort 3) |
| Over the lifetime cap | `0x2::allowance::consume` | `EExceedsLifetimeCap` |
| Before the start time | `0x2::allowance::consume` | `ENotStarted` |
| After expiry (15 s allowance, paid at +20 s) | `0x2::allowance::consume` | `EExpired` |
| Sender isn't the spender | input checks, before Move runs | "Invalid withdraw reservation: Transaction sender is not the spender of allowance …" |
| After revoke | input resolution | "Object … not found" (the allowance is deleted) |

Findings:

- **The SDK pays gas from the address balance when it can** (`enable_address_balance_gas_payments`).
  With owner = sponsor, the owner's *address balance* paid both the payment and the gas, while its coins
  were untouched. **The runtime sponsor must be a separate wallet from any funder.** Otherwise sponsoring
  gas eats the funds the allowances spend, at least for SUI-denominated allowances.
- `tx.build` simulates for gas, so a doomed spend throws at build ("Transaction resolution failed:
  MoveAbort … 'EOverPaymentCap'") with a clever-error name and source line. That's good enough for the
  "Why?" drawer (N4).

## 7. Testnet run via Tatum (pending funding)

`bun --env-file=.env spikes/allowance/flow.ts testnet <step>`: `deposit` (timing the settlement) →
`publish` → `issue` → `pay` (spender signs, sponsor pays gas) → `negatives` / `windows` (simulate only)
→ `revoke`. Digests, settlement delay and abort codes go here.

**Tatum rate limit:** a burst of `GetBalance` calls on testnet got **HTTP 429**, which grpc-js reports
as `UNAVAILABLE`. `withRetry` now defaults to 4 attempts with a 500 ms base. The runtime needs a client
side limiter.

## 8. Mainnet run (pending, needs Uy's OK per transaction)

`flow.ts mainnet <step>` only simulates unless `--execute` is passed. USDC amounts ≤ 0.10 per
transaction.
