# E2E (Playwright)

The suite lives in `e2e/` (workspace `@remora/e2e`). U4 built it, and [ADR-0029](../adr/0029-u4-web-and-e2e.md) records the choices.

## Run

```bash
docker compose up -d          # local Postgres (the server needs it)
bun run e2e                   # starts the server (8797), facilitator (8798), merchants (8799) and web (5183), runs every project
bun run --filter @remora/e2e e2e -- --project=smoke   # one project
E2E_BASE_URL=https://<main> bun run e2e:main           # smoke against a deployment
```

**Ports** are 8797 (API), 8798 (facilitator + gas station), 8799 (demo merchants) and 5183 (web), never 8787/5173, which another project uses. The W2 run needs `SPONSOR_PRIVATE_KEY_TESTNET` (the gas station) and uses `SPIKE_SPENDER_KEY`'s address as the merchants' payTo unless `MERCHANT_PAYTO_TESTNET` is set.

## Projects

| Project | What it proves |
|---|---|
| `smoke` (Desktop Chrome) | Every page paints signed out: `/`, `/onboarding`, `/funds`, `/verify`, and the W2 pages (`/remoras`, `/remoras/new`, `/memory`, `/approvals`, `/settings`), which ask for a wallet session first. Also checks the TESTNET badge, that nothing scrolls sideways, and that mainnet is offered but disabled |
| `mobile` (Pixel 7) | The same pages at phone width |
| `testnet` | The burner wallet signs in (A1), every API call carries `x-remora-network: testnet` (A9), Detect funds, Withdraw 0.10 to a coin when there are no coins, Move to the address balance (A4), then **Pause all** from the header and Resume each Disc (N10) |
| `w2` | **The W2 exit** (U5 Phase C), with the burner as owner:<ul><li>sign in → create a Scout with a Disc in **under 3 minutes**;</li><li>go live and ask: it pays `sui-risk` and answers, and the Wake verifies anchored (G3);</li><li>an over-limit `odds` purchase is paid once from the inbox (E4);</li><li>a Sentinel learns "ignore incoming SUI under 0.01" and applies it to real transfers (0.001 → ignored, 0.02 → ping);</li><li>the Scout is retired (B8): the owner signs the revoke.</li></ul>Global setup revokes any `remora-*` Disc a stopped run left behind.Timings and digests go to `e2e/test-results/w2-exit.json` |

## Env (root `.env`, never committed)

| Key | Why |
|---|---|
| `E2E_BURNER_KEY` | The testnet burner: a `suiprivkey1…` holding a little SUI and USDC. **Never a real owner.** Global setup issues it one Disc if it has none |
| `TATUM_API_KEY_TESTNET` | Node-side building for the test wallet, and global setup |
| `DATABASE_URL` | Local Docker Postgres (sessions) |
| `MEMWAL_ACCOUNT_ID` | Optional. Without it the harness boots the server with a placeholder ID, since memory isn't under test. Expect a harmless `relayer … 401` line |

## The injected test wallet

`e2e/support/test-wallet.ts` registers a wallet-standard wallet called **"Remora E2E Burner"** before the app loads.

- It supports `standard:connect`, `standard:events`, `sui:signPersonalMessage` and `sui:signTransaction`.
- Signing runs **in Node** through `page.exposeFunction`, so the burner key never enters the browser.
- It refuses any chain except `sui:testnet`.
- The app executes the signed bytes itself over gRPC-web (`useCoreExecutor`).

## Screenshots

Each run writes them to `e2e/screenshots/` (gitignored). The latest set is copied to [`docs/e2e/screenshots/`](screenshots/):

| Screenshot | Shows |
|---|---|
| `smoke-*.png` | desktop |
| `mobile-*.png` | phone |
| `testnet-funds-paused.png` | after Pause all |
| `testnet-funds-live.png` | after Resume |
