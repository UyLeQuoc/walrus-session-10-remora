# apps/merchants

Demo x402 merchants (E9). `sui-risk` is live: a paid report on any Sui object or package (age, last change, `UpgradeCap` holder, flags), read through Tatum gRPC. `odds` and `brief` come in W2.

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Run:** `MERCHANTS_PORT=8799 bun run --filter @remora/merchants start`. Needs `MERCHANT_PAYTO[_TESTNET]`, `FACILITATOR_URL[_TESTNET]` and `TATUM_API_KEY[_TESTNET]`.
- **Route:** `GET /sui-risk/:id` (x402, Disc-aware, 0.01 USDC by default).
