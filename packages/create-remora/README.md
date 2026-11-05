# create-remora

Scaffold a paid API in one command. Remoras, and any other x402 or MPP client, pay it in USDC on
Sui testnet.

```sh
npx create-remora my-api       # or: bunx create-remora my-api
cd my-api
npm install
cp .env.example .env           # set PAY_TO to the Sui address that gets paid
npm start                      # selling haiku on http://localhost:8790/haiku
curl -i "http://localhost:8790/haiku?q=walrus"   # 402: 0.005 USDC to PAY_TO on sui:testnet
```

- **What you get:** Remora's
  [sell-an-api example](https://github.com/UyLeQuoc/walrus-session-10-remora/tree/main/examples/sell-an-api)
  as a project of its own. A Hono route sits behind `x402(...)` from
  [`@getremora/merchant`](https://www.npmjs.com/package/@getremora/merchant), which answers x402
  and MPP on the same 402. It settles each payment through Remora's public facilitator before your
  handler runs.
- **It never overwrites anything:** the folder must be new or empty.
- **The project's README** ends with how to list it on the Reef, where remoras find services to
  buy.

## In this repo
- **Owner:** Uy Le ([ADR-0140](../../docs/adr/0140-create-remora-publishable-packages.md)).
- **`template/`** is the project it writes. Its `src/app.ts` and `src/app.test.ts` are the
  example's, word for word, and a test checks that.
- **Dotfiles** are stored without the dot (`gitignore`, `env.example`), because npm drops
  `.gitignore` from a tarball.
- **Build it and see the tarball:**
  `bun run --filter create-remora build:npm && npm pack --dry-run ./packages/create-remora/dist`.
