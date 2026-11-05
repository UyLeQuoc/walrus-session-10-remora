# Sell an API to remoras (E13)

This is an x402 endpoint in about 20 lines (`src/app.ts`). Any remora can pay it in USDC on Sui
testnet. Payments are verified and settled by Remora's public facilitator
([apps/facilitator](../../apps/facilitator/README.md#public-facilitator-testnet), [ADR-0111](../../docs/adr/0111-scale-pass.md)).
The same 402 also speaks MPP, the Payment HTTP auth scheme ([ADR-0120](../../docs/adr/0120-mpp-on-every-door.md)),
so MPP clients such as `@suimpp/mpp` can pay it too.

```sh
PAY_TO=0x<your testnet address> bun run --filter @remora/example-sell-an-api start
# selling haiku on http://localhost:8790/haiku
curl -i "http://localhost:8790/haiku?q=walrus"   # 402: 0.005 USDC to PAY_TO, sui:testnet
# the 402's body is x402's; its WWW-Authenticate: Payment header is the MPP challenge
```

- **`FACILITATOR_URL`:** where payments are verified and settled. The default is
  `https://getremora.vercel.app/api/facilitator`.
- **`PRICE`:** in USDC's smallest units, as a whole number. The default is `5000` (0.005 USDC).
  Anything else stops it at start. Restart it with a new `PRICE` to raise the price, for example to
  test a subscriber that should notice a price hike.
- **MPP payments by digest** (what `@suimpp/mpp` sends after paying) are read over gRPC from Mysten's
  public testnet fullnode, never JSON-RPC.

To let remoras find it, list its URL in the Reef from the app's **List your API** page. A remora's
owner then lets it pay your address with one signature, and asks "ask @haiku …".

To start your own API from this one, run `npx create-remora my-api` once it's on npm
([packages/create-remora](../../packages/create-remora/README.md), [ADR-0140](../../docs/adr/0140-create-remora-publishable-packages.md)).
