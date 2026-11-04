# ADR-0126: A remora on sale has a public page where anyone pays one answer from a wallet

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 B4, [ADR-0119](0119-u18-learning-loop-everyday-money.md))

## Context
Since U17 a remora on sale answers at `/api/x402/r/:slug`. Only another remora (a Disc and a server)
could pay it, though: a judge without an account couldn't try a paid answer themselves. The door
already takes a plain x402 `exact` payment (it doesn't require a Disc). Its 402's gas station is the
facilitator on the server's own host (ADR-0099), but the public facilitator proxy
(`/api/facilitator/gas`, ADR-0113) sponsors testnet gas for any buyer.

## Decision
- **`/r/:slug` on the web,** with no sign-in:
  - what the remora does, its price, the owner's address it pays, and its last ten sales with
    their digests;
  - this comes from `GET /api/public/r/:slug`, which shortens buyer addresses.
- **The visitor pays from their own wallet:**
  1. connect a testnet wallet;
  2. the door's 402;
  3. a `0x2::coin::send_funds` of the price to the owner, through `coinWithBalance`, which also draws
     on address balances;
  4. gas from `/api/facilitator/gas`;
  5. the wallet signs;
  6. the retry with `X-PAYMENT`.
  - The door settles only after the answer is written (`settle: "after"`), so a failed answer costs
    nothing.
  - The page shows the answer, the settled digest (with Verify), and what the remora paid its own
    sources.
- **The sale rules hold:**
  - depth 1;
  - the seller reads only `sources` and `feedback`;
  - the visitor's question isn't written to the seller's memory.
  - New: one question per 30 s per paying address (a wallet or a remora), refused before the answer,
    so nothing settles.
- **CORS:** the API accepts `x-payment` and exposes `x-payment-response`, for a cross-origin web
  build.
- **The seller's Sell card** links to its public page.

## Consequences
- Anyone with a testnet wallet and USDC can buy a real answer and verify the receipt. The
  per-payTo daily cap of the public facilitator (200 settles) bounds what we sponsor for one seller.
- The page is the demo for Best Use of Agent Payments without an account.

## Links
- `apps/web/src/features/public-remora/public-remora-page.tsx`, `apps/server/src/runtime/routes.ts`
  (`/api/public/r/:slug`).
- [ADR-0112](0112-remoras-on-sale.md), [ADR-0113](0113-community-listings-and-public-facilitator.md).
