# Goal H2: the public `/status` page on its safe endpoint (N20·ui, Huấn)

**Owner:** Huấn · **Runs in:** main checkout, on `main` · **Depends on:** U9 Phase 0 step 2 (the `/status`
contract PR) · **No E2E** ([ADR-0071](../adr/0071-huan-goals-without-e2e.md)).

The N20 page (`features/status/status-page.tsx`) landed in PR #11 but has no route, and it reads
`/api/health/deep`, which names balances and traceIds. U9 adds a public `GET /api/status` that returns
`{ status, items: { name, status }[] }` only, plus the route line. This goal moves the page onto it.

## Read first
- [N20 route request](../handoffs/2026-10-23-huan-to-uy-n20-status-route.md)
- [U9 goal](uy-09-testnet-launch.md), Phase 0 step 2
- `packages/schema/fixtures/health.report.json`, `apps/web/src/features/status/*`

## Allowed paths
`apps/web/src/features/status/**`, `apps/web/src/components/**` (if a shared piece is needed),
`apps/server/src/copy/**` (strings only).

## Steps
1. **Until the contract PR lands:** add a local fixture in the shape `{ status, items: { name, status }[] }`
   and build against it. If U9 hasn't opened the PR by Nov 2, write a handoff asking for a date.
2. **Switch the fetch** from `/api/health/deep` to `/api/status`. Remove every use of `detail`, `fix`,
   `value` and errors; the page shows a name and a status per item, nothing more.
3. **States:** loading skeleton, all green, some degraded, the API unreachable (show "Status unknown",
   not an error stack). Keep the 60 s refresh, and pause it while the tab is hidden.
4. **Layout** in the U13 page style (`Page`, `PageHeader`, `Section`). It works signed out and on a phone.
5. **Tests:** update `status-page.test.tsx` for the new shape and the four states; assert no field other
   than `name` and `status` is rendered.
6. **Review the contract PR** (`routes.tsx` line `{ path: "status", element: <StatusPage /> }`) and approve it.

## Done when
- [ ] typecheck, lint, test green
- [ ] `/status` renders signed out at 1280 and 375, light and dark, with the fixture and with the dev API
- [ ] No request to `/api/health/deep` from this page
- [ ] Pushed to `main`

## Never
- Show `detail`, `fix`, `value`, balances or traceIds on the public page.
- Edit `routes.tsx` outside the contract PR.
