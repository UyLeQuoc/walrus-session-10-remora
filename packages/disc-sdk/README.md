# @remora/disc-sdk

Pay x402 and MPP services on Sui through a Disc: an onchain spending limit an owner gives an agent
(`remora::disc`, ADR-0025). It also builds the owner's Disc transactions and reads Discs back.
It's transport-agnostic: pass a `SuiGrpcClient` on native gRPC (Node) or gRPC-web (browser), never
JSON-RPC.

On npm it's [`@getremora/disc-sdk`](https://www.npmjs.com/package/@getremora/disc-sdk)
(ADR-0140; npm's `@remora` scope is already taken).

```sh
npm install @getremora/disc-sdk @mysten/sui
```

```ts
import { discFetch } from "@getremora/disc-sdk";

const { response, payment } = await discFetch(
  {
    network: "testnet",
    cfg: { packageId, registryId, coinType: USDC }, // where remora::disc lives, see below
    disc: { discId, allowanceId, funder: owner }, // from the owner's buildIssue
    sender: remora.toSuiAddress(), // the Disc's spender
    sign: async (bytes) => (await remora.signTransaction(bytes)).signature,
    maxAmount: 10_000n, // 0.01 USDC: the soft budget for this call
    intentFor: (req) => sha256(JSON.stringify(req)), // 32 bytes, stored onchain in Paid
    client, // a SuiGrpcClient
  },
  "https://example.com/haiku?q=walrus",
);
```

On a 402 it builds `disc::pay`, gets its gas sponsored by the merchant's gas station, signs as the
remora and retries. The Disc enforces the hard limits onchain: payees, a cap per payment, a
lifetime cap or rate limit, and an expiry.

**Sui testnet:**
- `packageId`: `0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95e3c69e88434a5d6d`;
- `registryId`: `0x479454d5ed1b44000b03948dc2935c656c031e09f1b9508f4af38c54bb83b371`;
- USDC: `0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC`.

## In this repo
- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** E2 (builders), A4·be, B7·be, B9·be, N10·be; `disc.fetch` (the x402 client) comes with E3
- **Builders:**
  - owner: `buildIssue`, `buildRevokeAndReissue`, `buildRevoke`, `buildRotate`, `buildPause` (many Discs, i.e. the panic button), `buildSetPayees`, `buildSetPerPaymentCap`;
  - remora: `buildPay(cfg, args, { sender, gasOwner })`, sponsor-ready.
- **Readers:** `getDisc`, `getAllowance` (BCS of `sui::allowance` 1.82), `findDiscId` (registry table), `listOwnerDiscs`, `paidEvents`, `getFundsSplit`
- **Errors:** `toDiscError(err)` maps clever errors and validator rejections to `ERROR_CODES`.
- **Status:** v1, used by the testnet e2e (`spikes/disc/e2e.ts`, `docs/spikes/2026-10-19-disc-testnet.md`). Config IDs: `packages/schema` `DEPLOYMENTS` (contract PR #3).
- **npm (ADR-0140):** the workspace imports `src`. `bun run --filter @remora/disc-sdk build:npm`
  builds `dist/` with its own package.json, and `dist/` is what npm publishes.
