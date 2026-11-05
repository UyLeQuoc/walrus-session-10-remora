# @remora/merchant

x402 middleware for Hono (E9): `x402({ amount, networks, disc })` turns a route into a paid service. It answers `402` with requirements for each network it serves, then verifies and **settles before the handler runs**, through the facilitator. The handler reads `c.get("x402")` (`network`, `payer`, `transaction`, `intent`). The same 402 is an MPP challenge too (ADR-0120).

On npm it's [`@getremora/merchant`](https://www.npmjs.com/package/@getremora/merchant)
(ADR-0140; npm's `@remora` scope is already taken). `npx create-remora my-api` scaffolds a project that
uses it.

```sh
npm install @getremora/merchant hono
```

```ts
import { x402 } from "@getremora/merchant";
import { Hono } from "hono";

const USDC = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";
const app = new Hono();
app.get(
  "/haiku",
  x402({
    amount: "5000", // 0.005 USDC, in its smallest units
    networks: {
      testnet: {
        payTo: "0x<your address>",
        asset: USDC,
        facilitatorUrl: "https://getremora.vercel.app/api/facilitator",
      },
    },
  }),
  (c) => c.json({ haiku: "…" }),
);
```

Remora's public facilitator verifies and settles testnet payments, and sponsors the buyers' gas.

## In this repo
- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** E9, E8 (listing on Reef comes later)
- **npm (ADR-0140):** the workspace imports `src`. `bun run --filter @remora/merchant build:npm`
  builds `@remora/disc-sdk` and then this into `dist/`, each with its own package.json, and
  `dist/` is what npm publishes.
