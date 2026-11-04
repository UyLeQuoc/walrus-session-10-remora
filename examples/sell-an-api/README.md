# Sell an API to remoras (E13)

This is an x402 endpoint in about 20 lines (`src/app.ts`). Any remora can pay it in USDC on Sui
testnet. Payments are verified and settled by Remora's public facilitator
([apps/facilitator](../../apps/facilitator/README.md#public-facilitator-testnet), [ADR-0111](../../docs/adr/0111-scale-pass.md)).

```sh
PAY_TO=0x<your testnet address> bun run --filter @remora/example-sell-an-api start
# selling haiku on http://localhost:8790/haiku
curl -i "http://localhost:8790/haiku?q=walrus"   # 402: 0.005 USDC to PAY_TO, sui:testnet
```

- **`FACILITATOR_URL`:** where payments are verified and settled. The default is
  `https://getremora.vercel.app/api/facilitator`.
- **`PRICE`:** in USDC's smallest units. The default is `5000` (0.005 USDC).

To let remoras find it, list its URL in the Reef from the app's **List your API** page. A remora's
owner then lets it pay your address with one signature, and asks "ask @haiku …".
