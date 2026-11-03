# Deploy runbook

How Remora is deployed, what each service needs, the gate it has to pass, and how to roll back. **Deploys are Uy's step** (team-split §2): an agent deploys only when Uy asks, as for the first deploy on Nov 3 ([ADR-0099](adr/0099-first-deploy-one-railway-service.md)). This page is the checklist.

**Live:** <https://getremora.vercel.app> (web, Vercel project `getremora`) · `https://api-production-d2c7.up.railway.app` (API, Railway project `remora`, service `api`).

| Service | Code | Host | Start | Health check |
|---|---|---|---|---|
| API + runtime | `apps/server` | Railway service `api` | `node scripts/railway-start.mts` starts all three backend processes in one container ([ADR-0099](adr/0099-first-deploy-one-railway-service.md)) | `GET /api/health` (cheap; for the platform), `GET /api/health/deep` (the full report, [ADR-0052](adr/0052-health-diagnose-observability.md)) |
| Facilitator + gas station | `apps/facilitator` | the same container, `127.0.0.1:8798`, no public URL | (the start script) | the `facilitator` and `sponsor gas` items in `/api/health/deep` |
| Demo merchants | `apps/merchants` | the same container, `127.0.0.1:8799`, no public URL | (the start script) | a paid answer in the playground |
| Web | `apps/web` | Vercel project `getremora` (`apps/web/vercel.json`; `/api/*` rewrites to the Railway domain) | `vercel build --prod`, then `vercel deploy --prebuilt --prod`, from `apps/web` | the page loads; `/lab/health` shows the API's report |
| Database | Postgres | Railway, the same project, private network only (no public proxy) | n/a | in `/api/health/deep` |

## Environment
Values never go in the repo. `.env.example` lists every variable with a comment.

- **API** (`apps/server/src/env/schema.ts`, plus the memory operator vars from `@remora/memory`):
  - **database and sessions:** `DATABASE_URL`, `SESSION_SECRET` (≥ 32 chars), `KEY_ENCRYPTION_KEY` (the KEK that seals remora keys; back it up offline, because without it the keys are unrecoverable);
  - **web origins:** `WEB_BASE_URL`, `CORS_ORIGIN`;
  - **models:** `OPENROUTER_API_KEY`, `LLM_MODEL`, optional `LLM_SMALL_MODEL`;
  - **memory facts (F15, [ADR-0074](adr/0074-memory-facts-and-admission.md)):** `MEMORY_FACTS` (default `on`: the small model reads new memories for facts), `MEMORY_ADMISSION_JUDGE` (default `off`);
  - **chain:** `TATUM_API_KEY` / `TATUM_API_KEY_TESTNET` (gRPC only, ADR-0021); optional `SUI_GRPC_FALLBACK(_TESTNET)`, where calls go while Tatum answers 402 (default: the public fullnode; `off` turns it off, [ADR-0097](adr/0097-public-fullnode-fallback-when-tatum-is-out-of-credits.md));
  - **money:** `FACILITATOR_URL(_TESTNET)`, `MERCHANTS_URL(_TESTNET)`, `MERCHANT_PAYTO(_TESTNET)`;
  - **memory:** `MEMWAL_ACCOUNT_ID`, `MEMWAL_PRIVATE_KEY` (the operator delegate), `MEMWAL_SERVER_URL`;
  - **background work:** `WORKER=on`, `WATCHER=on`, `INDEXER=on` on exactly one instance; others run `WORKER=off INDEXER=off WATCHER=off CHANNELS=off`. `WATCHER` and `INDEXER` default to off, because they stream from Tatum the whole time they're on ([ADR-0058](adr/0058-tatum-credit-budget.md));
  - **channels:** `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` only on the instance that polls (Telegram allows one poller per token);
  - **Hatchery:** `WALRUS_*`; mainnet needs `WALRUS_PUBLISHER_MAINNET` (ADR-0048);
  - **playground:** `PLAYGROUND_*`; testnet only, and off without `PLAYGROUND_FUNDER_KEY` (ADR-0051).
- **Facilitator:**
  - `TATUM_API_KEY(_TESTNET)`, `TATUM_SUI_GRPC(_TESTNET)`, optional `SUI_GRPC_FALLBACK(_TESTNET)`;
  - `SPONSOR_PRIVATE_KEY(_TESTNET)` (the gas station);
  - `SPONSOR_DAILY_GAS_MIST`, `SPONSOR_MAX_GAS_BUDGET`;
  - `FACILITATOR_PORT`.
- **Merchants:** `MERCHANTS_PORT`, `FACILITATOR_URL(_TESTNET)`, `MERCHANT_PAYTO(_TESTNET)`, prices (`SUI_RISK_PRICE`, `ODDS_PRICE`, `BRIEF_PRICE`), `MERCHANT_REQUIRE_DISC`.
- **Set by `scripts/railway-start.mts`, not in Railway:** `FACILITATOR_PORT`, `MERCHANTS_PORT`, `FACILITATOR_URL_TESTNET`, `MERCHANTS_URL_TESTNET` (all on `127.0.0.1`). The facilitator and the merchants read the same variables as the API, so the service has one set.
- **Production secrets:** `SESSION_SECRET` and `KEY_ENCRYPTION_KEY` are not the local ones. They're in `.env.production` (gitignored) on Uy's machine, and the KEK has an offline copy.
- **Web:** `VITE_API_URL` when the API is on another origin (otherwise it's same-origin).

## The gate: `bun run diagnose`
Run it with the deploy's env **before** promoting a build, and don't ship while it fails.
- It checks every `DEPLOYMENTS` id onchain with its Move type (Disc package and registry, hatchery package and registry), Tatum, the relayer's `/config` and delegates, one memory recall (the relayer can embed and search, [ADR-0055](adr/0055-memory-failures-in-health.md)), the Walrus publisher and aggregator, and the facilitator.
- It then runs the memory doctor (account and delegate on chain against the relayer).
- It exits non-zero and prints the fix for anything that's down.

`REMORA_DEPLOYMENTS_OVERRIDE` is for tests only. Never set it on a real deploy.

## Steps
1. `main` is green: CI (typecheck, lint, test, link check, Tatum call list, `sui move test`) and `bun run e2e` on testnet.
2. Schema changes: review `packages/db` changes, then push them by hand. It's a deliberate step, never automatic, and agents never run it on shared databases unless Uy says so for that push. The database has no public URL, so `plan-push` runs inside the `api` container (the SSH key has to be registered once with `railway ssh keys add`). It prints the plan, and with `--apply` applies it only if every statement is additive:
   ```sh
   railway ssh --service api -- sh -c 'cd /app/packages/db && umask 077 && printf "DATABASE_URL=%s\n" "$DATABASE_URL" > /tmp/prod.env && node_modules/.bin/tsx scripts/plan-push.ts /tmp/prod.env [--apply]; rm -f /tmp/prod.env'
   ```
3. Run `bun run diagnose` with the target env. Stop here if it fails.
4. Deploy the backend, then the web:
   - `railway up --service api --ci` from the repo root (it uploads the working tree minus `.gitignore`; deploy from a clean checkout of `main`);
   - `vercel build --prod && vercel deploy --prebuilt --prod` from `apps/web`.
5. Check `GET /api/health/deep` (or `/lab/health`). Every item should be `ok`; `degraded` needs a reason.
6. Smoke the demo path on the deployment: `E2E_BASE_URL=<url> bun run e2e:main`.

## Rollback
- **Railway:** redeploy the previous successful deployment of each service (Deployments → Redeploy). The API is stateless apart from Postgres.
- **Vercel:** promote the previous production deployment.
- **Database:** schema pushes are additive by policy (new columns with defaults, new tables), so the previous build runs on the newer schema. A destructive change needs its own ADR and a backup first.
- **Onchain:** packages can't be rolled back. A bad Move release is fixed forward through the `UpgradeCap` (a multisig on mainnet), and owners can always pause or revoke their own Discs from their wallets.
- **Keys:** if a remora key may have leaked, owners rotate (B9) or pause all (N10). If the KEK may have leaked, rotate it with `rewrap`, which reseals every key, and rotate the remora keys.

## Mainnet (U9, Uy's call)
- Publish both Move packages from reviewed commits, and move both `UpgradeCap`s to the multisig.
- Fill `DEPLOYMENTS.mainnet` through a contract PR.
- Set `WALRUS_PUBLISHER_MAINNET`.
- Decide the playground's mainnet funder.
- Run `diagnose` for mainnet, then run the demo path twice in a row.
