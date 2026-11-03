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

## Later on Nov 3
- **The landing page and the app are one site**
  ([ADR-0100](../adr/0100-landing-and-app-one-site.md)).
  - Signed out, `/` on the deployed site shows the landing page; `/about` always does.
  - The web's Vercel build renames `index.html` to `app.html` and adds the landing next to it.
    Locally nothing changes.
  - `smoke.spec.ts` checks `/` as the landing page when `E2E_BASE_URL` is set. Please keep that
    when you touch it.
- **`w2.spec.ts` fails on the deployed site, and it's the selector.**
  - After "Pay once", the Approvals page shows the answer twice: in the approval card and in the
    "Paid" card. So `getByTestId("approval-answer")` matches two elements.
  - With `.first()` the whole W2 flow passes on the deployed site.
  - Either change the test, or show the answer once. Your call.
- **The playground's two suggestions now answer properly** (Uy's lane, in `apps/merchants`):
  - `sui-risk` no longer calls 0x1, 0x2 or 0x3 "younger than 7 days". The network upgrades them in
    place.
  - The `odds` snapshot is dated from the request, so tonight always has a match.
