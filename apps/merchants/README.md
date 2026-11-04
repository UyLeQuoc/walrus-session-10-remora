# apps/merchants

Demo x402 merchants (E9), all on one host. There are eight:

- `sui-risk`: a paid report on any Sui object or package (age, last change, `UpgradeCap` holder, flags), read through Tatum gRPC.
- `odds`: a cached sports-odds snapshot that ships with the merchant. It is demo data and says so.
- `brief`: a short summary of `?text=` or a public `?url=`. It uses an LLM when `OPENROUTER_API_KEY` is set and the first sentences otherwise. Page fetches reach public addresses only, never follow redirects, and are size-capped.

Five more since U16 ([ADR-0106](../../docs/adr/0106-wow-pass-more-uses.md)). Each one reads its source before the payment:

- `wallet`: what a Sui address holds, each coin in its own decimals, plus the kinds of objects it owns. Read over Sui gRPC.
- `walrus`: whether a Walrus blob reads, from the testnet or mainnet aggregator. Also its size, its kind and its first line. The aggregators don't report a blob's end epoch, so it doesn't claim one.
- `github`: a repo's stars, forks, open issues, license, archived flag and last push. From GitHub's public API, no key, cached for 10 minutes.
- `price`: SUI, WAL, BTC and ETH in USD, with the source and the time. From CoinGecko's public API, no key, cached for a minute.
- `weather`: a city's next three days, from Open-Meteo. No key; cached for 10 minutes.

**Sources first** (`sourceFirst` in `@remora/merchant`): `x402` settles before the handler runs, so a source that failed after the payment would charge for nothing. Each new route therefore reads its source in a check before `x402`:

- `price`, `weather`, `github` and `walrus` read it on the first, unpaid call too. So does `wallet`, when one network is served. A source that's down then fails before the buyer asks the gas station to sponsor anything.
- The paid call is served from the merchant's short cache.
- A failed read gets one retry.

**The demo's attacker** (`attack.ts`, [ADR-0108](../../docs/adr/0108-live-attack-bait-and-switch.md)) runs only with `DEMO_ATTACK=1`, never on a deployed host. `GET /market` answers every call with a 402 whose `payTo` is the attacker's address and whose description is an injected instruction. The safety check refuses it before anything is signed.

Owner, run command and routes:

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Run:** `MERCHANTS_PORT=8799 bun run --filter @remora/merchants start`. Needs `MERCHANT_PAYTO[_TESTNET]`, `FACILITATOR_URL[_TESTNET]` and `TATUM_API_KEY[_TESTNET]`.
- **Routes:**
  - `GET /sui-risk/:id` (0.01 USDC);
  - `GET /odds?q=` (0.02 USDC);
  - `GET /brief?url=|text=` (0.01 USDC);
  - `GET /wallet/:address` (0.01 USDC);
  - `GET /walrus/:blobId` (0.005 USDC);
  - `GET /github/:owner/:repo` (0.01 USDC);
  - `GET /price?symbols=SUI,WAL` (0.005 USDC);
  - `GET /weather?city=` (0.005 USDC).

  Prices: `SUI_RISK_PRICE`, `ODDS_PRICE`, `BRIEF_PRICE`, `WALLET_PRICE`, `WALRUS_PRICE`, `GITHUB_PRICE`, `PRICE_PRICE` and `WEATHER_PRICE`. A changed price must also change in the Reef (`apps/server/src/money/reef.ts`).
- **Disc:** every route accepts any `exact` payment, so an owner can pay once from the approval inbox. The facilitator reports the Wake intent whenever the payment came through a Disc. Set `MERCHANT_REQUIRE_DISC=1` to accept Disc payments only (ADR-0031).
