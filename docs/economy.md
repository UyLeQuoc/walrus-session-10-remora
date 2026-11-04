# Remora's open economy (U17)

Remoras can buy from more than the eight house services ([ADR-0111](adr/0111-scale-pass.md)). Every
purchase goes through the same rails: an x402 payment through the remora's Disc, under a limit that
Sui enforces.

## A remora sells its answers ([ADR-0112](adr/0112-remoras-on-sale.md))
- **Put it on sale:** on a Researcher's or a Briefer's page, under **Sell its answers**, pick:
  - a name (`@uy-researcher`);
  - a price, 0.005–0.05 USDC an answer;
  - one line about it.

  It's listed in the Reef as `reef:remora-<name>`, under **Remoras**.
- **The paid door:** `GET /api/x402/r/<name>?q=<question>`.
  - The 402 asks for the price at the **owner's address**, on testnet.
  - A paid call runs the remora's own turn. It pays its own sources from its own Disc, then
    answers.
  - The answer settles only once it's written. A failed answer costs the buyer nothing.
- **Buying from one:** on the buyer's page, **Buy from other remoras → Let it pay** signs
  `disc::set_payees` once. After that, "ask @name …" in its thread buys that remora's answer. The
  thread shows the receipt chain: the buyer's payment, then "→ it paid …" with the seller's own
  receipts.
- **Limits:**
  - A sold answer reads only what the remora learned about sources, never its owner's own memories.
  - It can't buy another remora's answer.
  - An owner's remoras never pay each other; they hand questions over for free.

## List your own API ([ADR-0113](adr/0113-community-listings-and-public-facilitator.md))
- **List it:** on **Services → List your API** (`/reef/new`), paste an x402 URL and pick a name.
  - Remora reads what its 402 asks for (exact, `sui:testnet`, USDC, at most 0.1 USDC).
  - You sign a message naming the URL, price and address. The signature moves no money.
  - It shows in the Reef under **Community**.
- **Buy from it:** as with a remora on sale. One signature lets a remora pay it, then
  "ask @name …".

## Settle through our facilitator
- **The facilitator:** any Sui x402 merchant on testnet can verify and settle at
  `https://getremora.vercel.app/api/facilitator`. Its buyers get sponsored gas there too. The
  limits are in [apps/facilitator](../apps/facilitator/README.md#public-facilitator-testnet).
- **A merchant in about 20 lines:** [examples/sell-an-api](../examples/sell-an-api).

## Pay over MPP too ([ADR-0120](adr/0120-mpp-on-every-door.md))
Every paid door speaks x402 and MPP, the Payment HTTP auth scheme
([draft-httpauth-payment-01](https://paymentauth.org/draft-httpauth-payment-01.txt)). That covers the
house services, a remora's sale door and [examples/sell-an-api](../examples/sell-an-api).
- **The 402:** the body is still x402's. A `WWW-Authenticate: Payment` header adds one `sui` charge
  challenge per network, plus `Cache-Control: no-store`.
  - The challenge's `request` is base64url JCS of the amount, the coin type and the payee.
  - The amount is in whole USDC (`"0.01"`), the way `@suimpp/mpp` reads it.
  - The id is an HMAC over the challenge, with a random nonce. A challenge works once, for 5 minutes.
- **Paying it:** retry with `Authorization: Payment <credential>`. Two payloads are accepted:
  - **a signed transaction:** the same sponsored Disc payment x402 uses. Our facilitator verifies and
    settles it, and a remora's sale door still settles only after the answer. `disc.fetch` sends this
    when a 402 offers only MPP. When both are offered, it pays over x402.
  - **a digest**, as `@suimpp/mpp` sends it: a payment the buyer already made, with a signature from
    the paying key. The door reads it over gRPC and lets each digest pay once. The payment is final
    before the work starts, so a failed answer isn't refunded.
- **The answer:** a paid 2xx carries `Payment-Receipt`, whose `reference` is the transaction digest.
  Errors are Problem Details (`application/problem+json`), and a 402 comes with a fresh challenge.
