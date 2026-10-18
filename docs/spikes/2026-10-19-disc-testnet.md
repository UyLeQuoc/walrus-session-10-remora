# U2: the real Disc on testnet, through Tatum

- **Goal:** [uy-02-disc-testnet.md](../goals/uy-02-disc-testnet.md) · **Decisions:**
  [ADR-0025](../adr/0025-disc-v1-design.md) · **Network:** testnet only ([ADR-0024](../adr/0024-testnet-first.md))
- **Code:** `packages/move/remora` (PR #2), `packages/disc-sdk`, `spikes/disc/e2e.ts`. The IDs are in
  contract PR #3
- **Toolchain:** Sui CLI 1.82.1, `@mysten/sui` 2.33.2, Tatum testnet gRPC with `PacedTransport` (3 req/s)

## Published (testnet)

| Thing | ID / digest |
|---|---|
| Package `remora` (disc v1) | `0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95e3c69e88434a5d6d` |
| `disc::Registry` (shared) | `0x479454d5ed1b44000b03948dc2935c656c031e09f1b9508f4af38c54bb83b371` |
| `UpgradeCap` (held by the spike owner key; multisig before mainnet, ADR-0025) | `0x663aa2f7ad81564a531d9e9ab8dd4bc1e7e1201524cfd1ae8ff3f8a9fc1bf742` |
| Publish digest | `DmFSq1ZQSFDnDNbikwsfiGKnmTTtwKDP38bSHMeS3rvE` |

## e2e (`bun --env-file=.env spikes/disc/e2e.ts run`), Circle testnet USDC

Everything is built with `@remora/disc-sdk` and goes through Tatum. The remora pays with sponsored gas
and holds 0 SUI. The owner key is also the sponsor, which is fine here because USDC is paid and SUI is
gas. It still breaks the "sponsor is never a funder" rule (ADR-0020), so the runtime gets its own
sponsor (D8).

| Step | Digest | Result |
|---|---|---|
| deposit 1 USDC `Coin` → address balance | `Cwbs9EAjutn9X8dtqQzvbRbS3AtH8oC1oUBhjieybQxx` | |
| issue (lifetime 0.20, per payment 0.02, payee = remora test address, expires in 7 days) | `DxBVdkUFGns3G1TPsGNSyqyUGowyLaTF9SGa9SuQ1V2E` | Disc `0x7645…d8bf`, allowance `0x87b7…e27e`, cap `0x6d91…410e`. `findDiscId` (registry table) returns the same Disc |
| pay 0.01 with intent | `8y1noHb8yZJ71BcP5RbQoAkc6xWdL9RGeQvCfj9Pk6SP` | **`Paid` read back by digest** (`LedgerService.GetTransaction`): amount 10,000, payee ok, intent `700f583d82a2f74750badc7e85493e401522e50216e4aebafb18d43973b668f4` = sha256 of the test intent |
| pause | `4av2BBVMNA6duWt9zYc6UrXYW6hGTZwbtHH4en5Njvaz` | |
| unpause | `5Ti2hy5aHPfDtjttkPUThuomEYpswbJ24TnqFucvTFDR` | |
| set payees (+ a second payee) | `9TmNReT64xEDVYkXnN6ppd3vwXzobJDixQEk7suU7pbc` | |
| pay the new payee | `xMaWTgWMNxQdffeLPaVKx6V5ce9TdypBUPJKjYLq6Co` | |
| rotate to a fresh key | `654o968Phu57P6L5P9G7XhavMsKmrVAVUSxxZXrHDFig` | |
| pay with the rotated key | `Em2BuX8wvEzqCfwa3qKykFMH7nSBq2npVT4m74iQgTGq` | |
| **revoke + reissue in one PTB** (same name, per payment 0.05, lifetime 0.30) | `4BAK91FE45tFBdx8EqfPaezuFudzRaWGsSvcwYfqXhbT` | new Disc, allowance and cap |
| pay 0.04 under the new budget (over the old cap) | `CefuFdagxEybsNZCqc97TRFgaBnR3aQuk3sq1VUcNzJV` | `listOwnerDiscs` shows 1 Disc, spent 40,000 |
| revoke | `A2BrLCFUFpuKfGfrhJsvNZRzd8a42VJRHLHaVKNgSQ8b` | |

The owner's USDC went from 19.970000 to 19.919000: −0.051 to the remora payee (0.01 + 0.001 + 0.04).
The 0.005 to the second payee was the owner's own address, so it netted out.

**Negative cases.** All were simulate-only and failed before execution, and `toDiscError` mapped
each one:

| Case | Typed code | Move constant |
|---|---|---|
| over the per-payment cap | `disc.over_per_payment_cap` | `EOverPaymentCap` |
| payee not allowed | `disc.payee_not_allowed` | `EPayeeNotAllowed` |
| over the lifetime cap | `allowance.over_lifetime_cap` | `0x2::allowance::EExceedsLifetimeCap` |
| sender isn't the spender | `disc.not_spender` | (input check: "Transaction sender is not the spender") |
| intent isn't 32 bytes (raw PTB, past the SDK's own check) | `disc.bad_intent` | `EBadIntent` |
| non-owner pause | `disc.not_owner` | `ENotOwner` |
| pay while paused | `disc.paused` | `EPaused` |
| old key after rotate | `disc.not_spender` | (input check) |
| pay after revoke | `allowance.revoked` | ("Object … not found") |

Rate limit, start and expiry are native and were covered in U1 (§7.1) and in `sui move test`.

## Notes for E3 (facilitator) and the runtime

- **Verify:** an allowance payment is a `disc::pay` call with a `FundsWithdrawal` input
  (`SenderAllowance { funder, allowance }`). `balanceChanges` show the payee's +amount (U1). For
  Disc-aware mode, also check that the PTB's only spend is `<package>::disc::pay` and read `Paid` from
  the simulated events (`include: { events: true }`).
- **Settle:** execute through Tatum (`PacedTransport` retries 429s), then `waitForTransaction`. Read
  `Paid.intent` back by digest and compare it with the Wake's intent hash (G2).
- **Gas:** sender = remora key, gas owner = sponsor; build with `buildPay(..., { sender, gasOwner })`.
  The sponsor must not be a funder.
- **Errors:** most rejections happen at `tx.build` (it simulates). Catch them, then `toDiscError(err)`
  gives a typed code for N4/N6. The validator rejects not-spender and revoked before Move runs.
- **Reading state:** `listOwnerDiscs(client.core, cfg, owner)` goes caps → allowances (BCS) → registry
  table → Discs. There's no gRPC event query, so history (`Paid`, `DiscUpdated`, …) comes from the
  checkpoint indexer.
