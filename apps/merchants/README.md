# apps/merchants

Demo x402 merchants (E9), all on one host:

- `sui-risk`: a paid report on any Sui object or package (age, last change, `UpgradeCap` holder, flags), read through Tatum gRPC.
- `odds`: a cached sports-odds snapshot that ships with the merchant. It is demo data and says so.
- `brief`: a short summary of `?text=` or a public `?url=`. It uses an LLM when `OPENROUTER_API_KEY` is set and the first sentences otherwise. Page fetches reach public addresses only, never follow redirects, and are size-capped.

Owner, run command and routes:

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Run:** `MERCHANTS_PORT=8799 bun run --filter @remora/merchants start`. Needs `MERCHANT_PAYTO[_TESTNET]`, `FACILITATOR_URL[_TESTNET]` and `TATUM_API_KEY[_TESTNET]`.
- **Routes:**
  - `GET /sui-risk/:id` (0.01 USDC);
  - `GET /odds?q=` (0.02 USDC);
  - `GET /brief?url=|text=` (0.01 USDC).

  Prices: `SUI_RISK_PRICE`, `ODDS_PRICE`, `BRIEF_PRICE`.
- **Disc:** every route accepts any `exact` payment, so an owner can pay once from the approval inbox. The facilitator reports the Wake intent whenever the payment came through a Disc. Set `MERCHANT_REQUIRE_DISC=1` to accept Disc payments only (ADR-0031).
