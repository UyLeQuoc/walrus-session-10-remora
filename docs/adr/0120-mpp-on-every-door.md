# ADR-0120: Every x402 door also speaks MPP, shaped like @suimpp/mpp's `sui` method

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 B5)

## Context
Goal U18's B5 ([ADR-0119](0119-u18-learning-loop-everyday-money.md)) asks every paid door to speak
MPP, the Payment HTTP auth scheme, beside x402. The doors are the house services, a remora's sale
door and `examples/sell-an-api`.

What the drafts say (read on Nov 5):
- **The scheme** ([draft-httpauth-payment-01](https://paymentauth.org/draft-httpauth-payment-01.txt)):
  - a 402 carries `WWW-Authenticate: Payment` with `id`, `realm`, `method`, `intent`, `request` and
    `expires`, and `Cache-Control: no-store`;
  - `request` is base64url, without padding, of JCS JSON;
  - the retry carries `Authorization: Payment <base64url {challenge, source?, payload}>`;
  - a 2xx carries `Payment-Receipt` and `Cache-Control: private`, and errors are Problem Details;
  - a malformed credential gets a 402 with a fresh challenge, and two credentials get a 400.
- **The charge intent** (draft-payment-intent-charge-00) says `amount` is in base units.
- No IETF draft defines a `sui` method. The only implementation is `@suimpp/mpp` 0.9.0 (MIT, built
  on `mppx`). We read its source on GitHub (`packages/mpp`):
  - the method is `sui`, intent `charge`, and the request is `{amount, currency, recipient}`;
  - `amount` is in **whole units** ("0.01"), converted with the coin's decimals by both sides;
  - the client executes a `send_funds` itself and sends `payload: {digest, signature}`, where
    `signature` is a personal-message signature over a fixed JSON proof (domain
    `suimpp.sui.payment-proof`, the challenge id, amount, coin, payee and digest);
  - the server reads the transaction over gRPC. The payee must be credited at least the amount, the
    proof's signer must be the sender, and each digest is used once.
- `mppx`'s client echoes the challenge with `request` re-encoded as JCS and `opaque` decoded to an
  object.

## Decision
- **One middleware, both protocols.** `x402()` in `@remora/merchant` also speaks MPP, on unless
  `mpp: false`. The shared wire format (base64url, JCS, challenge parsing, amounts) is in
  `@remora/disc-sdk` (`mpp.ts`); the server half is in `@remora/merchant` (`mpp.ts`).
  - **x402 doesn't change.** Its 402 body is the same; it only gains the two headers above.
- **The challenge:** one `sui` charge challenge per network the door sells on.
  - **The request** is `{amount, currency, recipient, methodDetails: {network, decimals, gasStation,
    disc?}}`.
    - The amount is in whole units, following `@suimpp/mpp` rather than the charge draft. A
      base-unit amount would make its clients pay 10⁶ times the price.
    - `methodDetails` is ours: `@suimpp/mpp` ignores it and echoes it.
  - **The id** is the draft's HMAC-SHA256 over realm, method, intent, request, expires, digest and
    opaque. It's tested against the draft's test vector.
  - **A random nonce** goes in `opaque`. Without it, two challenges for the same price in the same
    second would share an id, and the second buyer would be refused.
  - **The secret** is `mpp.secret` (`MPP_SECRET` for the house services). Unset, it's random per
    process, so a restart only voids open challenges and the client gets a fresh 402.
  - **Each challenge is single-use** (an in-memory set, kept until it expires), and expires after
    5 minutes.
  - **The realm** is the request's host.
- **Checking a credential:**
  - The realm must be ours.
  - The echoed request, re-encoded as JCS, must equal what this door asks now (price, coin, payee,
    network). So a challenge from another door, or from before a price change, is refused.
  - Then the HMAC, then the expiry, then the payload's shape, then single use.
  - `opaque` is accepted as the string we sent or as the object `mppx` echoes.
- **Two payloads:**
  - **`{type: "transaction", transaction, signature}`:** the signed, sponsored transaction x402
    uses. It goes to the door's facilitator as an x402 payment, so Disc checks, sponsorship and
    `settle: "after"` (ADR-0111) all work the same.
  - **`{digest, signature}`:** `@suimpp/mpp`'s. The door reads the transaction over gRPC (never
    JSON-RPC, ADR-0021), through a `client` passed per network. The transaction:
    - must have succeeded and credited the payee at least the amount in the coin;
    - must carry a proof signed by its sender for this challenge;
    - must not have executed more than 60 s before the challenge was issued, so an old payment can't
      buy a new call after a restart empties the in-memory digest set;
    - can pay for one call only (the digest is kept a day).
  - A door without a client, or one that takes Disc payments only, refuses digests.
- **Answers:**
  - A 2xx gets `Payment-Receipt {status: "success", method: "sui", timestamp, reference: <digest>}`.
  - Errors get Problem Details. A 402 comes with fresh challenges, and two credentials (or an MPP
    credential beside `X-PAYMENT`) get a 400.
  - **A malformed credential gets a 402,** as the draft's table and `mppx` do. The B5 brief said 400.
- **The doors:**
  - The house services pass their Tatum clients.
  - The sale door passes the runtime's client, and records a sale from the paid context, not
    x402's response header.
  - The example uses a new `createPublicSuiClient` from `@remora/chain` (Mysten's public fullnode,
    native gRPC). It now depends on `@remora/chain`.
  - `sourceFirst` reads an MPP credential's network, so a paid source loads before payment as with
    x402.
- **The client:** `disc.fetch` pays a 402 with no usable x402 requirement over MPP.
  - It builds the same sponsored `remora::disc::pay` and sends a `transaction` payload.
  - It prefers x402 when both are offered.
  - It returns the receipt's digest as `settle.transaction` and marks `protocol: "mpp"`.
- **Dependencies:**
  - No `@suimpp/mpp` or `mppx`. A test sends the credential exactly as `mppx` + `@suimpp/mpp` 0.9.0
    serialize it, built from their source.
  - `@mysten/sui` moves from `@remora/merchant`'s dev dependencies to its dependencies, for the
    signature check.
  - The example gains the workspace package `@remora/chain`.

## Consequences
- **Easier:**
  - `@suimpp/mpp` clients and any MPP client with a `sui` charge method can pay every Remora door,
    and remoras can pay MPP doors that offer a gas station (ours).
  - The submission can say "x402 and MPP on Sui" for Best Use of Agent Payments.
- **Harder or not done:**
  - **Remoras can't pay digest-only MPP merchants yet,** such as a plain `@suimpp/mpp` server. That
    needs the remora to execute through the sponsor, then sign a personal-message proof. It's a
    follow-up.
  - **A digest payment is final before the work.** On the sale door, a failed answer paid by digest
    isn't refunded. This is inherent to `@suimpp/mpp`'s push mode, and the economy doc says so.
  - **The replay sets are in memory, per process.** That's fine for one Railway instance. Several
    instances would need `MPP_SECRET` and a shared store.
  - **A settle-first MPP answer that fails after settling has no receipt** (the draft forbids one on
    an error), so the buyer finds the digest onchain. x402's response header still rides that error.
  - **The live exit is the lead's:** one MPP-paid call to a house service and one to a sale door on
    testnet.
- **Docs updated:** `docs/economy.md` (Pay over MPP too), `examples/sell-an-api/README.md`,
  `docs/deploy.md` and `.env.example` (`MPP_SECRET`).

## Links
- [draft-httpauth-payment-01](https://paymentauth.org/draft-httpauth-payment-01.txt),
  [draft-payment-intent-charge-00](https://paymentauth.org/draft-payment-intent-charge-00.txt).
- [@suimpp/mpp](https://github.com/mission69b/suimpp/tree/main/packages/mpp) 0.9.0 and
  [mppx](https://github.com/wevm/mppx) 0.4.9.
- [Goal U18, B5](../goals/uy-18-learning-loop.md), [ADR-0119](0119-u18-learning-loop-everyday-money.md),
  [ADR-0111](0111-scale-pass.md) (`settle: "after"`), [ADR-0021](0021-sui-grpc-only.md) (gRPC only),
  [ADR-0031](0031-e4-owner-payment-and-merchants.md) (Disc-only merchants).
