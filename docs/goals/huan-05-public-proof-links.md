# Goal H5: public proof links for Wakes (G6·ui, Huấn)

**Owner:** Huấn · **Runs in:** main checkout, on `main` · **Depends on:** U9 Phase A (G6 endpoints and
route in the contract PR); start on fixtures · **No E2E** ([ADR-0071](../adr/0071-huan-goals-without-e2e.md)).

An owner can share one Wake (the receipt for an action) as a public link that anyone can open and verify,
without signing in. U9 accepted:
- `POST /api/wakes/:id/share` → a public token (owner only, revocable);
- `GET /api/public/wakes/:token` → a redacted Wake with its verify checks, no auth.

## Read first
- [W3 backend requests](../handoffs/2026-10-23-huan-to-uy-w3-backend-requests.md) item 10
- `docs/remora-features.md` G3, G5, G6; `docs/threat-model.md` (what must stay private)
- `packages/schema/wake.ts`, fixtures `wake-view.payment.json`, `verify-result.payment.json`
- `apps/web/src/features/verify/verify-page.tsx`, `features/remoras/why-drawer.tsx`

## Allowed paths
`apps/web/src/features/verify/**`, `apps/web/src/features/remoras/why-drawer.tsx`,
`apps/web/src/components/**`, `apps/server/src/copy/**` (strings).

## Steps
1. **Fixtures:** a redacted public Wake built from `wake-view.payment.json` (what the server will drop:
   ask in the contract PR, assume prompts and memory text are removed).
2. **Share button** in the Why? drawer and on `/verify/:ref` when the viewer owns the Wake:
   - a confirm step that says what becomes public;
   - after sharing: the link, a copy button, and "Stop sharing" (revoke);
   - pending and error states (N6).
3. **Public page** (route asked in the contract PR, e.g. `/p/:token`):
   - works signed out, no shell roster, no owner controls;
   - shows the redacted Wake and the verify checks with pass/fail;
   - "Revoked or not found" state;
   - Open Graph title and description so the link previews in chats.
4. **Reuse** the verify result component rather than drawing checks twice.
5. **Tests:** owner sees Share, non-owner doesn't; revoke hides the link; the public page renders signed
   out and never renders fields missing from the redacted shape.

## Done when
- [ ] typecheck, lint, test green
- [ ] Share flow and public page render at 1280 and 375, light and dark, on fixtures (and the dev API
      once it exists)
- [ ] Pushed to `main`

## Never
- Render anything on the public page that the redacted response doesn't contain.
- Edit `routes.tsx` or `packages/schema` outside the contract PR.
