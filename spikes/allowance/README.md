# spikes/allowance (throwaway)

U1 spike scripts ([goal](../../docs/goals/uy-01-spike-allowance.md), [notes](../../docs/spikes/2026-10-21-allowance.md)). Keys come from the root `.env` (`SPIKE_OWNER_KEY`, `SPIKE_SPENDER_KEY`, `SPIKE_SPONSOR_KEY`, `TATUM_API_KEY[_TESTNET]`).

```bash
bun --env-file=.env spikes/allowance/probe.ts testnet           # read-only: chain info, feature flags, funds split
bun --env-file=.env spikes/allowance/flow.ts testnet <step>     # status | deposit | publish | issue | pay | negatives | revoke
bun --env-file=.env spikes/allowance/flow.ts mainnet <step>     # simulates only; --execute needs Uy's OK per transaction
```

State (package, registry, allowance IDs) goes to `.state.<network>.json`, which is gitignored. Owner: Uy Le.
