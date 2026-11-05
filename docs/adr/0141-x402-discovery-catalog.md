# ADR-0141: The public facilitator lists the Reef as an x402 Bazaar catalog, and paid doors describe themselves

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
U19 C4 ([spec](../goals/uy-19-it-gets-better.md#c4-the-reef-discoverable-by-x402-indexers)): x402
indexers such as x402scan read a facilitator's catalog at `GET /discovery/resources`. Our public
facilitator (U17, [ADR-0111](0111-scale-pass.md)) had none, so the Reef couldn't be found outside
Remora.

The shape, checked on Nov 5 against:
- the x402 spec, §8.1 "GET /discovery/resources"
  ([v2](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md), and v1);
- the Bazaar extension spec
  ([specs/extensions/bazaar.md](https://github.com/x402-foundation/x402/blob/main/specs/extensions/bazaar.md));
- the TypeScript client's `DiscoveryResource` and `DiscoveryResourcesResponse`
  ([facilitatorClient.ts](https://github.com/x402-foundation/x402/blob/main/typescript/packages/extensions/src/bazaar/facilitatorClient.ts));
- CDP's list endpoint
  ([List x402 resources](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/list-x402-resources.md),
  [Bazaar](https://docs.cdp.coinbase.com/x402/bazaar.md),
  [Get discovered](https://docs.cdp.coinbase.com/x402/seller/get-discovered.md)) and
  [x402 extensions](https://docs.x402.org/extensions/overview.md).

What they agree on:
- **The response:** `{ x402Version, items, pagination: { limit, offset, total } }`.
- **Each item:** `resource` (URL), `type: "http"`, `x402Version`, `accepts` (PaymentRequirements),
  `lastUpdated` (ISO 8601). Optional: `description`, `mimeType`, `serviceName` (printable ASCII, at
  most 32), `tags` (at most 5), `extensions`. v1 also had a free-form `metadata` object.
- **The query:** `type`, `payTo`, `scheme`, `network`, `limit` (1–100, default 20 in the spec, 100
  at CDP) and `offset`.
- **The extension:** a paid door declares `extensions.bazaar` in its 402:
  - `info.input` is `{ type: "http", method, queryParams?, pathParams? }`, and `info.output` is
    `{ type, example }`;
  - `schema` is JSON Schema 2020-12 that validates `info`;
  - `routeTemplate` (`/users/:id`) keys a door with path parameters.

## Decision
- **`GET /api/facilitator/discovery/resources`** (`routes/discovery.ts`, `money/discovery.ts`).
  Through the web it's `https://getremora.vercel.app/api/facilitator/discovery/resources`, the same
  way the facilitator's other public routes are reached.
  - It's public and read-only, with the API's per-address ceiling (30 a minute).
  - A built catalog is served for 60 s (`Cache-Control: public, max-age=60`).
  - `limit` defaults to 20 and is capped at 100. `offset` starts at 0. A bad number answers 400
    `discovery.bad_query`.
  - The filters are `type` (only `http` has items), `payTo`, `network` (`sui:testnet` or `testnet`)
    and `scheme`.
- **It lists only the Reef's verified listings on testnet,** house doors first, then community APIs,
  then remoras on sale:
  - **house doors:** listed while their merchants answer `GET /health`;
  - **community APIs:** listed while an unpaid GET still answers a 402 for the listed price at the
    listed address (the listing probe, `probeX402`). The item's `accepts` is that 402's own offer;
  - **remoras on sale:** an active remora's sale is its own check. A retired or paused remora's
    sale is already gone from the Reef, and a retired remora's API listings with it;
  - the house doors and the community APIs are checked at most every 5 minutes. What fails a check
    drops out until it passes again. The demo attacker (ADR-0110) is never listed;
  - a deployed server lists public https URLs only. Locally, loopback and private hosts are listed
    too.
- **Each item** is built with the code the doors use for their 402s:
  - `accepts` comes from `requirementsFor` in `@remora/merchant`, with the same description, timeout
    and Disc flag the door uses. A test checks the catalog's weather item against the weather door's
    own 402;
  - `resource` is the listed URL with path parameters filled from the door's example, so an indexer
    that calls it gets a 402;
  - `extensions.bazaar` is the door's own extension (below);
  - `description`, `serviceName` (the Reef name) and `tags` (`remora-reef`, the kind, the
    category);
  - `lastUpdated` is the last passed check (or the build time, for a sale);
  - `metadata` is `{ name, description, kind, category, ref, reefScore }`, where `reefScore` is
    `scoreLine` ("new" until there's enough, [ADR-0127](0127-reef-reputation-from-shared-counts.md)).
- **`x402Version` is 1** (`X402_VERSION`), on the response and on each item, because that's what our
  doors' 402s say. Their requirements already use v2's field names (`amount`, `sui:testnet`).
- **Paid doors describe themselves.** `x402()` takes an optional `discovery`. With it, the 402 body
  carries `extensions.bazaar` (`bazaarExtension` in `packages/merchant/src/discovery.ts`). Without
  it, the body is unchanged.
  - `HOUSE_DOORS` holds each house door's description and discovery (example input, output and
    route template). The merchants' 402s and the catalog both read it.
  - A remora's sale door uses `saleDoor()` from `money/discovery.ts`: `?q=` and the answer's
    shape.
  - A community API's item gets a minimal extension (`GET`, no example), because we don't know its
    input.
- **Entries are data:** a remora that finds a service in the catalog still pays it only if its Disc
  lists the payee, at the listed address ([ADR-0109](0109-pay-only-at-listed-address.md)).
- No new dependency.

## Consequences
- An x402 indexer or an agent can find the Reef from the facilitator's URL alone, see what each
  door costs, who it pays and what it takes, and get a 402 back from the listed URL.
- **In production the house doors don't appear yet:** the merchants run on `127.0.0.1` in the API's
  container ([ADR-0099](0099-first-deploy-one-railway-service.md)). The deployed catalog lists
  remoras on sale and community APIs. Listing the house doors needs a public merchant URL, which is a
  deploy decision for Uy.
- The doors' `extra.gasStation` is `FACILITATOR_URL_TESTNET`'s, which in production is the
  in-container address (`scripts/mpp-exit.ts` already notes this). An outside buyer passes the public
  `/api/facilitator/gas` instead. Advertising the public gas station is a follow-up.
- A new community listing appears at the next check, within 5 minutes.
- The spec exit's payment through the catalog (`disc.fetch` pays a house door found there) is run on
  testnet by the lead.

## Links
- `apps/server/src/money/discovery.ts`, `apps/server/src/routes/discovery.ts`,
  `packages/merchant/src/discovery.ts`, `packages/merchant/src/x402.ts`, `apps/merchants/src/main.ts`.
- [economy.md § Discovery](../economy.md#discovery-adr-0141),
  [apps/facilitator](../../apps/facilitator/README.md#public-facilitator-testnet).
- [ADR-0111](0111-scale-pass.md), [ADR-0113](0113-community-listings-and-public-facilitator.md),
  [ADR-0127](0127-reef-reputation-from-shared-counts.md), [ADR-0134](0134-u19-it-gets-better-and-anyone-can-check.md).
