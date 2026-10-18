# ADR-0031: Over-limit approvals are a one-off owner payment; demo merchants accept any exact payment

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Uy (agent, U5 Phase A)

## Context
E4 says "the owner signs a one-off payment in one tap". The remora's Disc can't make that payment, because it is over the Disc's per-payment cap. The owner isn't the Disc's spender either. So the owner has to pay from their own address balance. That payment is a plain `exact` transfer with no `remora::disc::pay` and no `Paid` event. The demo merchants were Disc-aware (`extra.disc: true`), and the facilitator rejected anything without a `Paid` event (`not_a_disc_payment`).

E9 also needs the `odds` and `brief` merchants (spec §12.5). `brief` fetches pages that a remora names. Those URLs can come from untrusted text, so fetching them is an SSRF risk.

## Decision
- **E4 flow:**
  1. `approvalPayTx` reads the merchant's live 402.
  2. It builds `coin::redeem_funds` (address-balance withdrawal) followed by `coin::send_funds` to `payTo`, with the owner as sender.
  3. The owner signs this in their wallet and pays their own gas. The sponsor policy only covers Disc calls, and the owner already needs SUI to issue a Disc.
  4. `approvalPay` sends the signed payload to the merchant as `X-PAYMENT`.
  5. On success the approval becomes `approved`, a `payment` event records `approvedBy: owner`, and Scout answers the original question with the bought data, under a Wake.
- **Merchant behaviour:**
  - Demo merchants accept any `exact` payment by default.
  - `MERCHANT_REQUIRE_DISC=1` restores Disc-only acceptance.
  - The facilitator now reports `intent` whenever a `Paid` event to the `payTo` for that amount is present, whether or not the requirement is Disc-aware. A Disc-aware requirement still rejects a payment without one.
  - G3 verification is unchanged. It reads `Paid.intent` from the chain, not from the merchant.
- **`odds`:** a cached snapshot that ships with the merchant. Every answer says it is demo data and not live odds.
- **`brief`:**
  - It summarizes `?text=` or a public `?url=`. It uses an LLM when `OPENROUTER_API_KEY` is set and the first sentences otherwise. The prompt says the text is data, not instructions.
  - URL fetches: http(s) only. Every resolved address must be public (no loopback, private, link-local, CGNAT, ULA or metadata ranges). No redirects, 8 s timeout, 200 KB cap.
  - An empty request or a non-http URL is refused before the 402, so a bad request costs nothing.
- **Prices:** sui-risk 0.01, odds 0.02 and brief 0.01 USDC (`SUI_RISK_PRICE`, `ODDS_PRICE`, `BRIEF_PRICE`). They match the Reef (E7).

## Consequences
- E4 works with the wallet the owner already has. The approved payment is not a Disc payment, so its Wake has the settle digest but no `Paid` anchor. G3 reports it as not anchored, which is correct.
- A third party can pay the demo merchants without a Disc. That is harmless for demo data. A Disc-only deployment sets the flag.
- DNS rebinding between our lookup and the fetch is still possible in theory. The demo accepts that; a production `brief` should pin the resolved address.

## Links
- `apps/server/src/runtime/approvals.ts`, `apps/merchants/src/{odds,brief}.ts`, `apps/facilitator/src/facilitator.ts`
- ADR-0020 (the sponsor is never a funder), ADR-0028 (W1 rails), spec §12.5
