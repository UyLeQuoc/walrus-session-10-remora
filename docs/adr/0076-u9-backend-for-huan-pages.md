# ADR-0076: The backend for Huấn's H2–H6 pages: status, cost, Reef, proof links, leaving Remora

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (written by Uy's agent; Uy said "làm hết đi", so the U9 triage stands as written)

## Context
- Huấn built five pages on local fixtures and asked for their endpoints
  ([request, Oct 29](../handoffs/2026-10-29-huan-to-uy-h2-h6-contract.md)). Every page shows a quiet "not
  available yet" until they exist.
- U9 Phase 0 and A ([goal](../goals/uy-09-testnet-launch.md)) had triaged them:
  - yes: `/status` (N20), the cost card (N15), the Reef directory (E7), public proof links (G6);
  - yes if time allows: account export and exit (A8).
- Huấn asked two questions:
  - should a shared Wake show the decision's `reason`?
  - should "retire all" include shadow and paused remoras?

## Decision
- **The server side lands on `main` now, with its own types.** It mirrors Huấn's local zod shapes exactly.
  Moving those types into `packages/schema` and adding the three route lines is a contract PR for both of
  us to approve.
- **`GET /api/status`** (public): `{ status, items: [{ name, status }] }` from the same cached health
  report as `/api/health/deep` (30 s). No detail, value, threshold, fix or error. If the report fails,
  it answers `degraded`.
- **`GET /api/remoras/:id/cost?month=YYYY-MM`** (owner): micro-USDC integer strings.
  - **Model:** the month's tokens (`remora_usage`) at the average of the model's input and output price
    per 1M tokens. Only total tokens are recorded, so this is an estimate.
    - `google/gemini-2.5-flash`, the default and not in the picker's catalog, uses its OpenRouter list
      price.
    - A model with no known price is charged at the catalog's $1 ceiling.
  - **Gas:** settled sponsored gas for the remora's key (`sponsor_ledger`), at the **SUI price from
    Tatum's Data API** (`/v4/data/rate/symbol`, cached for 10 minutes).
    - Testnet gas is priced as if it were mainnet SUI.
    - With no price, the card answers `cost.no_price` (409) rather than a wrong zero.
  - **Purchases:** the amounts of the remora's pay Wakes that have a transaction.
- **`GET /api/reef/services`** (public): `{ name, category, priceUsdc, payTo, docsUrl }[]`, with `payTo`
  for the session's network. Categories and the docs link (the merchants README) are a listing beside
  the Reef, so `ReefEntry` didn't change.
- **Public proof links (G6):**
  - **Endpoints:**
    - `POST /api/wakes/:id/share` returns `{ token, url }`. It is owner-only and idempotent.
    - `DELETE` revokes the link.
    - `GET /api/public/wakes/:token` needs no session.
  - **Storage.** The token is 128 random bits (base64url) in `receipts.share_token`, with a unique index.
    It's stored as is, so sharing again returns the same link. The view it opens is public chain data
    plus the checks.
  - **The public view is an allow-list:** `v`, `remora` (the name), `network`, `ts`, `action` (for a
    payment: `payee`, `payTo`, `amount`), `tx`, `agent`, `intentHash`, `anchored` and `checks`.
  - **The decision's `reason` stays private** (answer to Huấn): model prose can quote private context.
  - The view is cached for 60 s per token, because its checks read the chain through Tatum.
- **Leaving Remora (A8):**
  - **`GET /api/account/export`** returns `{ v: 1, exportedAt, memories, wakes }` for the owner's remoras
    on both networks.
    - Memories come from the per-remora F8 export (relayer recalls; an explicit, rare action).
    - Wakes come from `receipts`, without share tokens.
  - **`POST /api/account/retire`** returns `{ transaction, remoraIds }`: one owner PTB that revokes every
    live Disc on the session's network.
    - **Shadow, paused and Disc-less remoras are included** (answer to Huấn).
    - A Disc already revoked elsewhere is forgotten.
    - With nothing to sign, it answers `account.nothing_to_sign` (409); with no remoras,
      `account.nothing_to_retire` (409).
  - **`POST /api/account/retire/confirm { digest }`** returns `{ retired }`.
    - It checks the owner sent the digest.
    - It retires each remora whose Disc is gone (or never existed).
    - A Disc still live keeps its remora as it was, so a failed signature can't mark anything retired.
- **New error codes:**
  - `cost.bad_month`, `cost.no_price`;
  - `wake.not_found`, `wake.not_shared`;
  - `account.nothing_to_retire`, `account.nothing_to_sign`.

  `apps/server/src/copy` is Huấn's, so they use the server's sentences until he adds copy keys.

## Consequences
- **Huấn's pages work** once the contract PR merges and the API is deployed.
- **`receipts` gains two nullable columns** (`share_token`, `shared_at`) and a partial unique index.
  - This is additive. It was pushed only to the local database.
  - **A shared database needs `db:push` by hand before the deploy** ([deploy.md](../deploy.md) step 2).
- **Tatum's Data API** now prices gas, beside the gRPC calls.
- **The cost card's model line is an estimate** until per-call prices are recorded.

## Links
- [Huấn's request](../handoffs/2026-10-29-huan-to-uy-h2-h6-contract.md) ·
  [the answer](../handoffs/2026-10-31-uy-to-huan-h2-h6-answers.md)
- [U9 goal](../goals/uy-09-testnet-launch.md) · [ADR-0052](0052-health-diagnose-observability.md) ·
  [ADR-0058](0058-tatum-credit-budget.md)
