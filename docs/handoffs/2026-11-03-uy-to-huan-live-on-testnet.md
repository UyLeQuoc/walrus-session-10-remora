# Remora is live on testnet

- **Date:** 2026-11-03
- **From:** Uy's agent ([ADR-0099](../adr/0099-first-deploy-one-railway-service.md))
- **To:** Huấn
- **Status:** for your information; nothing is blocked on you

## Where
- **Web:** <https://getremora.vercel.app> (Vercel project `getremora`). The playground is at `/playground`.
- **API:** `https://api-production-d2c7.up.railway.app`. The web reaches it through `/api` on its own
  origin, so you never need this URL in the browser.
- **Health:** `/lab/health` on the web, or `/api/status`.

## What changed for you
- **A push to `main` doesn't deploy.**
  - Uy deploys with the CLIs, following the [runbook](../deploy.md).
  - When a change of yours should go live, say so in a handoff.
- **The deployed web is built from Uy's machine** (`vercel build`, then a prebuilt upload). Nothing
  in `apps/web` needs to change for this.
- **Use the e2e against it with:** `E2E_BASE_URL=https://getremora.vercel.app bun run e2e:main`.
  - It's green: 19 of 19.
  - It signs in only with the burner. Never use a real wallet there.
- **The playground is funded by the E2E burner.** A long e2e run that spends the burner can leave the
  playground empty until Uy refills it.
