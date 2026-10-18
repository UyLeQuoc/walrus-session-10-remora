# spikes/disc (testnet only)

The U2 e2e of the real Disc through Tatum, built with `@remora/disc-sdk` ([notes](../../docs/spikes/2026-10-19-disc-testnet.md)). Keys come from the root `.env` (`SPIKE_*`, `TATUM_API_KEY_TESTNET`). The owner needs testnet SUI and Circle testnet USDC.

```bash
SPIKE_MOVE_DIR=<path to packages/move/remora> bun --env-file=.env spikes/disc/e2e.ts publish   # once per package version
bun --env-file=.env spikes/disc/e2e.ts run                                                      # the full flow + negatives
```

State and results go to `.state.testnet.json` / `.results.testnet.json` (gitignored). There's no mainnet mode (ADR-0024). Owner: Uy Le.
