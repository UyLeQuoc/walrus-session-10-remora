# Goal U3: The whole W1 rails end to end, network-switchable (testnet first)

**Owner:** Uy Le · **Runs in:** the main checkout, on `main` (ADR-0022) · **Depends on:** U2 (Disc v1 merged,
`DEPLOYMENTS.testnet`) · **Networks:** both are wired, and only testnet is exercised
([ADR-0024](../adr/0024-testnet-first.md), [ADR-0026](../adr/0026-network-switch.md))

**Goal:** finish every remaining W1 item in Uy's lane **in one goal**, so the W1 exit criterion passes on
testnet:

> A real x402 call is paid from a remora key through its Disc. It's sponsored, the funds come from
> the owner's address balance, `Paid.intent` matches the stored Wake, and the indexer recorded it.

Everything is network-aware, so mainnet works once Uy's pass publishes it.

## Read first
- `docs/remora-plan.md` W1, `docs/remora-spec.md` §5, §6, §7 (payments), §9 (Wake), §12.1, §12.3
- `docs/spikes/2026-10-21-allowance.md` and `docs/spikes/2026-10-19-disc-testnet.md` (the E3 notes at
  the end)
- ADRs `0015`, `0020`, `0021`, `0024`, `0025`, `0026`; `docs/tech-reference.md` §2.2, §3.2 (x402), §3.3
- The code: `packages/chain`, `packages/disc-sdk`, `packages/schema` (`wake.ts`, `funds.ts`,
  `deployments.ts`, `errors.ts`), `apps/server` (route registry, env schema), `spikes/disc/e2e.ts`

## Allowed paths
- **Server:** `apps/server/src/{money,runtime,ops,triggers,tools}/**`. `apps/server/src/routes/registry.ts`
  and `apps/server/src/env/schema.ts` are append-only; one line in `apps/server/src/index.ts` to start
  the worker and indexer.
- **Apps and packages:** `apps/facilitator/**`, `apps/merchants/**`,
  `packages/{chain,disc-sdk,signer,merchant}/**`, `packages/db/src/schema/{money,runtime}.ts`.
- **Other:** `spikes/**`, `.env.example` (append keys), `docs/spikes/**`, `docs/tech-reference.md`,
  `docs/adr/**`, `docs/handoffs/**`.
- `packages/schema` changes only through **one contract PR**. `apps/web` is Huấn's: send him a handoff.

## Steps (in order; each with tests)
1. **A9·be: network layer** (ADR-0026).
   - A `networks` module builds per-network config from `DEPLOYMENTS[network]` + env (Tatum key, sponsor
     key) and creates a `@remora/chain` client per network, lazily.
   - Middleware reads `x-remora-network` (default `SUI_NETWORK`). It rejects unavailable networks with
     a typed error.
   - `GET /api/networks` lists the networks and their availability.
   - Contract PR: `Network`, `NETWORK_HEADER`, the `NetworksResponse` schema + fixture.
2. **K1: observability.** A structured logger (JSON) with request ID, network and remora ID, plus error
   capture. Keys and secrets are never logged (add a test).
3. **D2: durable jobs.** A Postgres queue in `runtime.ts`:
   - fields: kind, payload, an `idempotency_key` (unique), attempts, `run_at`, status, `last_error`;
   - a worker with exponential backoff, a dead-letter state and dedupe;
   - tests against local Docker Postgres.
4. **B4: key custody** in `packages/signer`.
   - Generate an Ed25519 key per remora and envelope-encrypt it: a per-key data key (AES-256-GCM),
     wrapped by `KEY_ENCRYPTION_KEY`. Store it in the DB.
   - Decrypt only inside `signer.sign(remoraId, txBytes)`. Never return or log the key. Tests cover
     tamper detection.
5. **D8: gas sponsor** (`money/sponsor`). A sponsor key per network (`SPONSOR_PRIVATE_KEY`,
   `SPONSOR_PRIVATE_KEY_TESTNET`).
   - Co-sign as the gas owner.
   - Keep a per-remora daily gas budget in a ledger table and refuse past it (`sponsor.out_of_gas`).
   - Low-balance alert.
   - **Refuse to sponsor if the sponsor address is a funder of the Disc** (ADR-0020).
6. **A4·be: funds API.**
   - `GET /api/funds` (owner + remora addresses → `getFundsSplit`) for Detect funds, shaped as the
     schema's `DetectFundsResult`.
   - Unsigned-tx builders the owner's wallet signs: "move to address balance" (`coin::send_funds`) and
     "withdraw to coin".
7. **E3: facilitator** (`apps/facilitator`, Hono). x402 `exact` for `sui:testnet` and `sui:mainnet`.
   - `/verify`: network match, signature, simulate via Tatum, `payTo` balance change == `amount`, not yet
     executed. Disc-aware mode also requires the `disc::pay` call and a `Paid` event in the simulation.
   - `/settle`: execute via Tatum, wait, return the digest.
   - `/supported`, plus a **gas station** that co-signs with the D8 sponsor.
   - Unit tests plus a testnet test.
8. **E9 + `@remora/merchant`.** Hono middleware turns a route into an x402 service: it answers `402`
   with PaymentRequirements for the request's network, then verifies and settles through the
   facilitator. The demo merchant **`sui-risk`** returns package age, the `UpgradeCap` holder and the
   object owner, read through Tatum gRPC.
9. **E2: `disc.fetch` (x402 client) + G1/G2.**
   - On a 402, check the soft budget, then build `buildPay` with `intent = sha256(canonical Wake
     intent)` (`@remora/schema` `intentHash`).
   - The remora signs with B4 and the sponsor co-signs with D8. Then retry with the payment header.
   - Store the Wake (intent, result, digest, network) and enqueue settlement follow-ups on D2.
10. **D1 (chain part): checkpoint indexer per network.** `SubscribeCheckpoints` through Tatum.
    - Store `remora::disc` events (`Paid`, `DiscIssued`, `DiscUpdated`, `SpenderRotated`,
      `DiscRevoked`) in `money.ts` tables, keeping a cursor per network.
    - Resume after a restart. History reads come from here.
11. **W1 exit e2e (testnet)** in `spikes/w1/`. Start Postgres, the server (`CHANNELS=off`), the
    facilitator and `sui-risk` locally, on ports that don't collide with 8787/5173.
    - Create a remora key (B4), and have the owner issue its Disc (U2 SDK).
    - The remora calls `sui-risk` via `disc.fetch` → 402 → pay → facilitator verify/settle → 200.
    - Check: sponsored gas; the owner's address balance down by the amount; `Paid.intent` == the stored
      Wake's intent hash; the indexer has the `Paid` row.
    - Negatives: over cap, payee not in the Disc, sponsor budget exhausted, and network `mainnet`
      refused while unavailable.
    - Record the digests in `docs/spikes/2026-10-xx-w1-exit.md`.
12. **Docs and ADRs:** tech-reference (facilitator, indexer, signer), spec §7/§12.3 if they changed, an
    ADR for each decision (queue design, key envelope, indexer storage…), and a handoff to Huấn for
    anything the UI needs (`/api/funds`, `/api/networks`, the error codes).

## Done when
- [ ] The W1 exit e2e passes on testnet through Tatum, with digests recorded
- [ ] Every step above has unit tests; typecheck, lint, test and `sui move test` are green; CI is green
- [ ] `GET /api/networks` shows testnet available and mainnet unavailable; requests with `x-remora-network:
      mainnet` get a typed refusal
- [ ] The contract PR is open (network types, plus anything new the API returns)
- [ ] Docs, ADRs and handoffs are written; everything else is pushed to `main`

## Never
- Touch mainnet: no transactions, no publish (ADR-0024). Mainnet code paths exist but only run when
  Uy calls the pass.
- Use the sponsor key as a funder, or log keys or secrets. Commit `.env`.
- Deploy to Railway or Vercel (that's Uy's step), or push the DB schema anywhere but local Docker.
- Edit `apps/web` or Huấn's copy (send him a handoff instead).
