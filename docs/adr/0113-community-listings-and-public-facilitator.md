# ADR-0113: Anyone can list an API in the Reef, and any Sui x402 merchant can use our facilitator

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U17, [ADR-0111](0111-scale-pass.md))

## Context
ADR-0111 asks for two ways in for people outside Remora:
- an owner lists their own x402 API in the Reef (E8);
- any Sui x402 merchant settles through our facilitator (E13).

Two constraints shape both:
- The agent never pushes the DB schema, so a listing can't have its own table.
- The facilitator runs on `127.0.0.1` in the API's container (ADR-0099), with no public URL.

## Decision
- **Listing an API** (`/reef/new`, `POST /api/reef/probe` and `/api/reef/listings`):
  - **The probe:** one unpaid GET. It must answer 402 with an `exact`, `sui:testnet`, USDC
    offer, a `payTo` and a price of at most 0.1 USDC.
  - **Where it may point:** on a deployed host, only public `https` addresses (DNS checked).
    Locally, `http://localhost` works too, for testing.
  - **The signature:** the owner signs a personal message naming the name, URL, price, `payTo` and
    themselves. The server probes again and accepts only that owner's signature over that exact
    message. If the API changed in between, the signature no longer matches.
  - **Storage:** the listing lives in the config of one of the owner's remoras (`config.listings`,
    the newest one that isn't retired). That's no schema push. Retiring that remora takes its
    listings down. Each owner may list at most 5.
  - **In the Reef:** a listing is `reef:community-<slug>`, shown as "@slug" under **Community**,
    sharing names with remoras on sale. It's never a template's default payee: an owner lets a
    remora pay it with one `set_payees` signature (ADR-0112). "ask @slug …" buys it.
  - Sonar's listed-address check still applies. An API that later asks to be paid at another
    address is blocked.
- **The public facilitator** (`/api/facilitator`): the API forwards `supported`, `verify`,
  `settle` and `gas` to the facilitator in the container. It serves `sui:testnet` only, with these
  caps:
  - 200 settlements per `payTo` per UTC day, a count that bounds the gas we sponsor for one
    merchant (the sponsor's per-sender daily gas budget still applies);
  - 10 gas-station calls per client address per minute, since each one holds a sponsor coin for up
    to 90 s;
  - the API's own 30 requests a minute per address.

  `examples/sell-an-api` shows a merchant in about 20 lines.

## Consequences
- **No contract change** beyond ADR-0112's optional `ReefService.kind`. The new workspace folder
  `examples/*` holds our own example, not a new dependency.
- **Listings and remoras are tied:** a listing goes away with the remora that holds it. A proper
  `reef_listings` table can replace this after the hackathon, with Uy's schema push.
- **The caps are in memory:** a restart resets them. The service runs one replica (see
  `iplimit.ts`).

## Links
- [ADR-0111](0111-scale-pass.md)
- [ADR-0112](0112-remoras-on-sale.md)
- [docs/economy.md](../economy.md)
- [apps/facilitator/README.md](../../apps/facilitator/README.md)
