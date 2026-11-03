# ADR-0099: The first deploy: one Railway service for the backend, Railway Postgres, the web at getremora.vercel.app

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Uy Le (asked for it: Railway for the backend, Vercel for the web, a short `vercel.app`
  name, and Railway kept cheap), Uy's agent

## Context
- This is U9 Phase D, the first public deploy.
- [ADR-0009](0009-deploy-railway-vercel-single-env.md) planned:
  - a Railway service each for the server, the facilitator, Reef and the merchants;
  - auto-deploy from `main`;
  - Neon as the database.
- Railway bills each running service for its memory and CPU. The facilitator and the demo merchants
  are small Hono apps that only the API calls. Reef is still a scaffold.
- Tatum's free plan is spent, so Sui calls fall back to the public fullnode
  ([ADR-0097](0097-public-fullnode-fallback-when-tatum-is-out-of-credits.md)).

## Decision
- **One Railway service, `api`, in the Railway project `remora`.**
  - It runs the API, the facilitator and the demo merchants as three processes in one container
    (`scripts/railway-start.mts`).
  - They reach each other on `127.0.0.1:8798` and `:8799`. The start script sets
    `FACILITATOR_URL_TESTNET` and `MERCHANTS_URL_TESTNET`.
  - If one process exits, the container exits non-zero and Railway restarts all three.
  - It runs one replica, because of Telegram.
  - Public domain: `api-production-d2c7.up.railway.app` (also `API_BASE_URL`, where agents reach `/mcp`).
- **Railway Postgres in the same project, on the private network only.**
  - It replaces Neon, so everything is in one project.
  - It has no public TCP proxy.
  - Schema pushes run `plan-push` inside the `api` container over `railway ssh`. They stay additive
    and stay a deliberate step.
- **The web on Vercel: project `getremora`, at <https://getremora.vercel.app>.**
  - It's built on the deploying machine (`vercel build --prod`) and uploaded prebuilt, because the
    build needs the workspace packages outside `apps/web`.
  - `/api/*` rewrites to the Railway domain, so the session cookie stays same-origin.
- **Deploys go through the CLIs, not auto-deploy from `main`.**
  - The commands are `railway up` and `vercel deploy --prebuilt --prod`.
  - A push to `main` doesn't redeploy, which suits the Nov 6 freeze.
  - Deploys stay Uy's call. This one ran because Uy asked for it.
- **Background work runs on that one instance:**
  - `WORKER=on`;
  - `WATCHER=on` (Sentinels; it streams from the public fullnode while Tatum answers 402);
  - `INDEXER=off`;
  - `CHANNELS=on` with Telegram only. Discord and Slack have no tokens there.
- **The playground is funded by the E2E burner,** Uy's choice from the U9 options, with the default limits.
- **The production `SESSION_SECRET` and KEK are new, not the local ones.**
  - They're kept in `.env.production`, which is gitignored.
  - Uy keeps an offline copy of the KEK.
- **Reef isn't deployed;** it's a scaffold.

## Consequences
- **Cheaper.** Railway runs one service plus a small Postgres instead of four services.
- **The facilitator and the merchants have no public URL.** Only remoras on this server buy from the
  demo merchants, and an outside x402 client can't reach them.
- **A crash in one process restarts all three.**
- **Deploying needs both CLIs logged in on the deploying machine.** Huấn's pushes don't deploy.
- **The playground and the e2e share the burner.** A run that drains it stops both until it's refilled.
- **Rollback is per deploy:** Railway redeploys an earlier deployment, and Vercel promotes an earlier one.
- **This supersedes ADR-0009 on three points:** the service layout, Neon, and auto-deploy.
  The [deploy runbook](../deploy.md), the README and the submission draft are updated.

## Links
- [deploy runbook](../deploy.md) · [ADR-0009](0009-deploy-railway-vercel-single-env.md) ·
  [ADR-0051](0051-playground.md) · [ADR-0058](0058-tatum-credit-budget.md) ·
  [ADR-0097](0097-public-fullnode-fallback-when-tatum-is-out-of-credits.md) ·
  [U9 goal](../goals/uy-09-testnet-launch.md)
