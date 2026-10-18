# ADR-0034: W2 web pages run on the live API behind a wallet session

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Uy (agent, U5 Phase B; Huấn's W2 UI items claimed under ADR-0027)

## Context
The U4 pages (`/remoras`, `/remoras/:id`, `/approvals`, `/memory`) painted contract fixtures. W2 needs them on real data, plus four new pages:
- create (A6/B1);
- settings (A7/H5/A5/N10);
- verify (G3);
- the dashboard (H4).

Every W2 route answers only for a wallet session (ADR-0032).

## Decision
- **One typed client.** `features/remoras/api.ts` parses every response with its `packages/schema` contract (ADR-0033). A shape mismatch shows as an error on the page, not a blank page. Errors show the server's human sentence (N6).
- **Wallet gate.** `RequireOwner` shows the wallet sign-in until `/api/me` has `signedIn` and a `walletAddress`. A connected wallet without a session isn't enough. `/verify` is public.
- **Owner transactions** (issue, pause, retire, budget, rotate, panic) use the existing `useSignAndRun`, which executes over gRPC. The page then calls the matching `/confirm`.
- **E4 approval payment** uses the wallet's `signTransaction` only. The merchant settles it through the facilitator, so the page never executes it (ADR-0031).
- **Live updates by polling.** The feed polls every 15–20 s, and every 5 s right after creation, so the first run (N13) appears without a reload. SSE stays for W3.
- **Routes and navigation.** New routes: `remoras/new`, `settings`, `verify`, `verify/:ref`. The sidebar adds Verify and Settings.
- **Smoke e2e** now checks that each W2 page asks for a wallet when signed out. The signed-in flow is the W2 exit e2e.
- **Fixtures** (`features/remoras/fixtures.ts`) are now the W2 API fixtures, used only by tests.

## Consequences
- Huấn's real visual design and final copy voice stay open (not claimed). Pages use the existing shadcn components.
- Schedules come from their own route (`GET /api/remoras/:id/schedules`), because `RemoraConfig` (the contract) doesn't carry them.

## Links
- `apps/web/src/features/{remoras,approvals,memory-inspector,settings,verify,onboarding}/`
- ADR-0027, ADR-0031, ADR-0032, ADR-0033; handoff `docs/handoffs/2026-10-19-uy-to-huan-u5-claim.md`
