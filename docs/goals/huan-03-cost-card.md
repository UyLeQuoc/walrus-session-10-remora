# Goal H3: the cost card on the remora page (N15·ui, Huấn)

**Owner:** Huấn · **Runs in:** main checkout, on `main` · **Depends on:** U9 Phase A (N15 endpoint +
contract PR); start on a local fixture · **No E2E** ([ADR-0071](../adr/0071-huan-goals-without-e2e.md)).

The owner should see what one remora cost this month, split into the model, gas and purchases. U9
accepted the backend: `GET /api/remoras/:id/cost?month=YYYY-MM` → `{ llmUsdc, gasUsdc, purchasesUsdc }`,
built from recorded turns, sponsored gas and payments only.

## Read first
- [W3 backend requests](../handoffs/2026-10-23-huan-to-uy-w3-backend-requests.md) item 9
- [U9 goal](uy-09-testnet-launch.md) Phase A
- `apps/web/src/features/remoras/remora-page.tsx` (Overview tab), `components/app/budget-meter.tsx`
- `docs/remora-features.md` N15, E6

## Allowed paths
`apps/web/src/features/remoras/**`, `apps/web/src/components/app/**`, `apps/server/src/copy/**` (strings).

## Steps
1. **Fixture first:** a local `cost.fixture.ts` in `features/remoras/` with one normal month, one empty
   month and one month where purchases dominate. Replace it with the schema fixture once the contract
   PR lands, and approve that PR.
2. **Hook** `useRemoraCost(id, month)` in `features/remoras/hooks.tsx` (TanStack Query, like the others).
3. **`CostCard`** on the Overview tab, next to the budget meter:
   - the total in USDC, then three rows: Model, Gas (sponsored), Purchases, each with its share;
   - a month picker (this month and the five before), defaulting to this month;
   - an empty state ("No spend this month") and a loading skeleton;
   - a `Term` glossary tooltip on "sponsored gas".
4. **Numbers:** USDC with 2 decimals, `< $0.01` for tiny non-zero values, no rounding to zero.
5. **Tests:** card renders the three rows and the total, the empty state, the month change refetches.

## Done when
- [ ] typecheck, lint, test green
- [ ] Card renders on `/remoras/:id` at 1280 and 375, light and dark, on fixtures and on the dev API
      once the endpoint exists
- [ ] Pushed to `main`

## Never
- Compute cost in the browser from other endpoints; the server's number is the truth.
- Edit `packages/schema` outside the contract PR.
