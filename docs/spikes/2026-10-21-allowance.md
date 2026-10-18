# Spike U1: address balances + app-bound allowances via Tatum gRPC

- **Goal:** [uy-01-spike-allowance.md](../goals/uy-01-spike-allowance.md) · **Decision:** [ADR-0020](../adr/0020-allowance-spike-go.md)
- **Status:** **GO** ([ADR-0020](../adr/0020-allowance-spike-go.md)). Versions, the read method, the
  localnet dry run (§6) and the **testnet run via Tatum** (§7) are done. The mainnet check (§8) waits for
  owner funding and Uy's OK per transaction.
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

## 7. Testnet run via Tatum (Oct 18)

Everything goes through `https://sui-testnet-grpc.gateway.tatum.io` (native gRPC, `PacedTransport` at
3 req/s). The owner was funded with 2 testnet SUI from Uy's CLI wallet (`cmdocs`), with Uy's OK, because
the faucet API is disabled. The owner key is also the gas sponsor. The spender holds 0 SUI.

| Step | Digest (testnet) | Notes |
|---|---|---|
| deposit 0.05 SUI `Coin` → address balance (`coin::send_funds`) | `HdCnPPRyAEYew4NsDKEnDnE2MjKeSMs9oXhyZ9Hw8DKa` | execute 1.65 s. **The address balance was readable on the first `GetBalance` after `waitForTransaction`** (3.2 s after submit). There was no extra settlement wait beyond finality |
| publish stub | `Fa7Frwzx9jQqj22CsGzMUMBKpYtZKXyipFYcJ2Ftwwzx` | package `0xa81fb7c0bd14ebacd232c6d175a6902186d1d9307ee4915077fbb688eb2fd73e`, registry `0xed500b60…57d3` |
| owner `propose_for_app` → `disc::issue` (one PTB) | `9b27JP6X8mf3nzp6bgDMY2qAKNpzuJTeAvD2nYLAWsMF` | allowance `0xde05b193…fa23`, lifetime cap 0.003 SUI, per payment 0.001 SUI |
| spender pays 0.001 SUI, sponsored gas | `71YKSzRn5vq1JMTeB8fhbzZwmvu9eoa41yiqgHDC1ixT` | simulate 1.0 s, execute 0.9 s. `balanceChanges`: payee **+1,000,000**, owner −2,000,391 (payment + gas, since owner = sponsor). Gas 0.001 SUI |
| issue "starts in 1 h" | `ZT3ssCTVrdGDMjvbiyQx99uL3S2tun7KrLodzi95Xf7` | for the `ENotStarted` case |
| issue "expires in 15 s" | `7kLks8PqS4z7B8tJ3iCjFgSJf53aN5ehoshNm6o8Enba` | for the `EExpired` case |
| revoke | `6TERiroEwtuttnjuqbfzu1TpuYnSCFKmWuuasBE55DRH` | allowance and cap deleted, policy key freed |

Negative cases on testnet were the same as on localnet (§6). **All seven fail before execution, with no
gas charged:**

| Case | Abort |
|---|---|
| Over the per-payment cap | `disc::EOverPaymentCap` (code 4), `disc::pay` line 82 |
| Payee not on the allowlist | `disc::EPayeeNotAllowed` (code 3), `disc::pay` line 78 |
| Over the lifetime cap | `0x2::allowance::EExceedsLifetimeCap`, `consume` line 415 |
| Before start | `0x2::allowance::ENotStarted`, `consume` line 406 |
| After expiry | `0x2::allowance::EExpired`, `consume` line 410 |
| Sender isn't the spender | input check: "Invalid withdraw reservation: Transaction sender is not the spender of allowance …" |
| After revoke | input resolution: "Object … not found" |

**x402 check:** the pay transaction's `balanceChanges` show the payee's +amount even though the money
moved with `balance::send_funds` into an address balance. So the `exact` scheme's verify step ("the
`payTo` balance change equals `amount`") works for allowance-funded payments, and the tech-reference
§3.2 caveat is resolved.

**Tatum rate limit:** without pacing, `tx.build` + simulate + execute got **HTTP 429** on
`ExecuteTransaction` (grpc-js reports it as `UNAVAILABLE`). The 429'd transaction never landed. The fix
is `PacedTransport` in `@remora/chain`: it spaces unary calls (3/s by default) and retries 429s, which is
safe even for execute because the gateway rejected the call.

## 8. Mainnet run (pending, needs Uy's OK per transaction)

`flow.ts mainnet <step>` only simulates unless `--execute` is passed. USDC amounts ≤ 0.10 per
transaction.
