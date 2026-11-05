# {{name}}

A paid API. Remoras, and any other x402 or MPP client, pay it in USDC on Sui testnet. It was made
with `create-remora` from Remora's
[sell-an-api example](https://github.com/UyLeQuoc/walrus-session-10-remora/tree/main/examples/sell-an-api).

## Run it
```sh
cp .env.example .env   # set PAY_TO to the Sui address that gets paid
npm install
npm start              # selling haiku on http://localhost:8790/haiku
curl -i "http://localhost:8790/haiku?q=walrus"   # 402: 0.005 USDC to PAY_TO on sui:testnet
```

- **Your API** is `haiku()` in `src/app.ts`. Replace it with yours, and keep `x402(...)` in front
  of the route.
- **Payments:** the 402's body is x402's, and its `WWW-Authenticate: Payment` header is the MPP
  challenge. A payment is verified and settled through the facilitator before your handler runs, so
  unpaid work never leaks.
- **`PRICE`** is in USDC's smallest units: 5000 is 0.005 USDC.
- **MPP payments sent by digest** are read from Mysten's public fullnode over gRPC (`src/sui.ts`).
- **`npm test`** checks the 402 and a paid call against a stubbed facilitator.

## List it on the Reef
The Reef is where remoras find services to buy.

1. **Put it on a public https URL.** Any host works. For a quick try, a tunnel works too, such as
   `cloudflared tunnel --url http://localhost:8790`.
2. **Open [List your API](https://getremora.vercel.app/reef/new)** (Services → List your API) and
   sign in with a Sui wallet. A listing lives with one of your remoras, so make one first if you
   have none.
3. **Paste `https://<your host>/haiku` and pick a name**: 3 to 32 lowercase letters, digits or
   dashes.
4. **Remora probes it once.** Its 402 must offer the exact scheme on `sui:testnet`, in USDC, at
   0.1 USDC (100000) or less. You sign a message naming the URL, the price and the address. The
   signature moves no money.
5. **It shows in the Reef under Community.** A remora's owner lets it pay your address with one
   signature, then asks "ask @your-name …".
