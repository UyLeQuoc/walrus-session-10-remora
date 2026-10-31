# Answers: the H2–H6 contract request (the backend is on `main`)

- **Date:** 2026-10-31
- **From:** Uy's agent ([ADR-0076](../adr/0076-u9-backend-for-huan-pages.md))
- **To:** Huấn
- **Status:** the server side is on `main`. The contract PR, with the schema types and the three route
  lines, is open for both of us to approve.
- **Replying to:** [the request of Oct 29](2026-10-29-huan-to-uy-h2-h6-contract.md)

## Item by item
| # | Item | Answer | Endpoint, as built |
|---|---|---|---|
| 1 | N20 `/status` | **Yes**, on `main` | `GET /api/status` → `{ status, items: [{ name, status }] }`. No other keys, from the same 30 s cached report as `/api/health/deep` |
| 2 | N15 cost card | **Yes**, on `main` | `GET /api/remoras/:id/cost?month=YYYY-MM` → `{ llmUsdc, gasUsdc, purchasesUsdc }`, micro-USDC strings. A bad month is `cost.bad_month` (400); no SUI price is `cost.no_price` (409) |
| 3 | E7 Reef directory | **Yes**, on `main` | `GET /api/reef/services` → `{ name, category, priceUsdc, payTo, docsUrl }[]`, public, `payTo` for the `x-remora-network` network |
| 4 | G6 public proof links | **Yes**, on `main` | `POST` and `DELETE /api/wakes/:id/share`, owner only. `GET /api/public/wakes/:token`: no session, 404 `wake.not_shared` when revoked or unknown |
| 5 | A8 export and exit | **Yes**, on `main` | `GET /api/account/export`, `POST /api/account/retire`, `POST /api/account/retire/confirm { digest }` |

## Your two questions
- **The decision's `reason` on a public Wake: no.** Model prose can quote private context, so your
  allow-list stands. The server never sends it.
- **Shadow and paused remoras in "retire all": yes,** and Disc-less ones too.
  - `remoraIds` lists every remora that isn't retired on the session's network.
  - The transaction revokes every live Disc.

## Things your pages should know
- **Cost.**
  - The model line is an estimate: the month's tokens at the average of input and output price.
  - Gas is priced with the SUI price from Tatum's Data API. Testnet gas is priced like mainnet SUI.
  - Purchases are the pay Wakes that have a transaction.
- **Proof links.**
  - `url` is `${WEB_BASE_URL}/p/<token>`.
  - Sharing again returns the same token. After `DELETE`, the old token answers 404.
  - The public view is cached for 60 s.
- **Retire all can answer 409:**
  - `account.nothing_to_sign`: no live Disc is left. Call `/retire/confirm` without a digest, and it
    retires them.
  - `account.nothing_to_retire`: there are no remoras.

  The confirm retires only remoras whose Disc is gone, so a remora whose Disc is still live stays as it
  is.
- **Export.**
  - It covers both networks.
  - `memories[]` are the F8 entries with `remora`, `remoraId` and `network` added.
  - `wakes[]` are `{ id, remoraId, network, intentHash, txDigest, anchored, wakeBlobId, createdAt,
    wake }`. It reads the relayer once per namespace, so it takes a few seconds.
- **Error copy.** The new codes use the server's sentences until you add `error.<code>` keys in
  `apps/server/src/copy`:
  - `cost.bad_month`, `cost.no_price`;
  - `wake.not_found`, `wake.not_shared`;
  - `account.nothing_to_retire`, `account.nothing_to_sign`.
- **`MERCHANT_PAYTO_TESTNET`** for your dev stack: leave it empty. The e2e derives it from
  `SPIKE_SPENDER_KEY` when that's set, or uses the fixed `0x3e3e…3e` (32 bytes of `3e`). Use the same
  fixed address locally.

## The contract PR
- **`packages/schema/src/launch.ts`** gets your shapes as they are:
  - `PublicStatus`, `CostResponse`, `ReefService`;
  - `PublicWake`, `ShareLink`;
  - `AccountExport`, `AccountRetire`, `AccountRetired`.

  Each has a fixture in `packages/schema/fixtures`.
- **`apps/web`** imports them from `@remora/schema` instead of the local copies. The TODOs go.
- **`routes.tsx`** gets three lines:
  - `status`;
  - `reef`;
  - `p/:token`, outside the sign-in guard.
- **F15's facts** (`FactView`, the facts and resolve responses) ride along, as the
  [F15 handoff](2026-10-31-uy-to-huan-f15-facts.md) offered.

## Not done
- **Deploy and the shared database.** `receipts.share_token` and `receipts.shared_at` are on the local
  database only. Uy pushes the schema at the deploy.
