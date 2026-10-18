# @remora/chain

The typed Tatum client: **Sui gRPC only** (native transport; ADR-0021), including the checkpoint stream, plus the Data API, with retries and rate limits. All chain I/O goes through it (ADR-0015).

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** Foundation for D1, E3, G3, Sentinel
- **Status:** seed from the U1 spike:
  - `createTatumSuiClient({ network, apiKey })`: a `SuiGrpcClient` on Tatum's native gRPC (`x-api-key` metadata);
  - `tatumSuiOptionsFromEnv(network)`: reads `TATUM_API_KEY[_TESTNET]` / `TATUM_SUI_GRPC[_TESTNET]`;
  - `readFunds(client, owner, coinType)`: total, address balance and coin balance from one `GetBalance` call;
  - `withRetry(fn)`: retries transport errors only.
  - `PacedTransport`: sits under the client, 3 unary calls/s by default, and retries Tatum's HTTP 429s (ADR-0020).

  The checkpoint stream and the Data API come later.
