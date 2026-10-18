# E2E (Playwright)

The suite lives in `e2e/` (workspace `@remora/e2e`). U4 built it, and [ADR-0029](../adr/0029-u4-web-and-e2e.md) records the choices.

## Run

```bash
docker compose up -d          # local Postgres (the server needs it)
bun run e2e                   # starts the server on 8797 and the web on 5183, runs every project
bun run --filter @remora/e2e e2e -- --project=smoke   # one project
E2E_BASE_URL=https://<main> bun run e2e:main           # smoke against a deployment
```

**Ports** are 8797 (API) and 5183 (web), never 8787/5173, which another project uses.

## Projects

| Project | What it proves |
|---|---|
| `smoke` (Desktop Chrome) | Every W1 page paints: `/`, `/onboarding`, `/remoras`, `/remoras/scout`, `/memory`, `/approvals`, `/funds`. Also checks the TESTNET badge, that nothing scrolls sideways, that mainnet is offered but disabled, and the "Why?" drawer |
| `mobile` (Pixel 7) | The same pages at phone width |
| `testnet` | The burner wallet signs in (A1), every API call carries `x-remora-network: testnet` (A9), Detect funds, Withdraw 0.10 to a coin when there are no coins, Move to the address balance (A4), then **Pause all** from the header and Resume each Disc (N10) |

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
