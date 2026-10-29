# Goal H4: the Reef directory page `/reef` (E7·ui, Huấn)

**Owner:** Huấn · **Runs in:** main checkout, on `main` · **Depends on:** U9 Phase A (E7 endpoint, route
line in the contract PR); start on a local fixture · **No E2E** ([ADR-0071](../adr/0071-huan-goals-without-e2e.md)).

The Reef is the list of paid services a remora may pay. Owners need to see it: what each service does,
what it costs, and which address gets paid. U9 accepted `GET /api/reef/services` →
`{ name, category, priceUsdc, payTo, docsUrl }[]`.

## Read first
- [W3 backend requests](../handoffs/2026-10-23-huan-to-uy-w3-backend-requests.md) item 4
- `docs/remora-features.md` E7, `docs/remora-spec.md` (Reef section)
- The U13 data-table style in `apps/web/src/openbot/pages/` and an existing table page (`/memory`)

## Allowed paths
`apps/web/src/features/reef/**` (new), `apps/web/src/components/**`, `apps/server/src/copy/**` (strings).

## Steps
1. **Fixture first:** `features/reef/fixtures.ts` with the demo merchants (e.g. `sui-risk`) plus 4–5 rows
   across categories. Swap to the schema fixture when the contract PR lands.
2. **Page `features/reef/reef-page.tsx`:**
   - a search field (name, category) and category filter chips;
   - a table: Name, Category, Price (USDC per call), Pays to (`Hash` component, copy button), Docs link;
   - on a phone, cards instead of the table;
   - empty, loading and error states.
3. **Glossary:** wrap "Reef" with `Term` (N14 skipped it in PR #11 because there was no static hit).
4. **Link it** from the remora page where Reef payees appear, and from the command palette's page list.
5. **Route:** ask for `{ path: "reef", element: <ReefPage /> }` in the U9 contract PR and approve it. Add the
   rail or palette entry only after the route exists.
6. **Tests:** search filters rows, category chips filter, `payTo` copy works, phone layout renders cards.

## Done when
- [ ] typecheck, lint, test green
- [ ] `/reef` renders at 1280 and 375, light and dark, on fixtures and on the dev API once it exists
- [ ] Pushed to `main`

## Never
- Let the page add or edit Reef entries (read only in W3).
- Edit `routes.tsx` outside the contract PR.
