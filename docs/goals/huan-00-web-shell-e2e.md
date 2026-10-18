# Goal H0: Web shell rebrand, ship-set page skeletons, E2E harness (W1, Huấn)

**Owner:** Huấn · **Runs in:** your main checkout, on `main` (no worktree, ADR-0022) · **Depends on:** U0
(bootstrap) on `main`.

## Read first
- `AGENTS.md`, `docs/team-split.md` (your lane, §2 paths, §7 goal rules, §8 environments)
- `docs/remora-features.md` §0 (ship set) and §2.1 (funds model)
- `docs/remora-spec.md` §12.1 (Detect funds UI), §12.12 (UX principles)
- `packages/schema` contracts + fixtures. **Build against the fixtures, read-only.**
- Reference: `reference/hippo/apps/web/src/features/{connect, me, guide}` (already ported in U0)

## Allowed paths
`apps/web/**` (except `features/lab`, which is Uy's), `apps/server/src/copy/**` (strings only), `e2e/**`,
`docs/ux/**`, `docs/e2e/**`.

## Steps
1. **Rebrand** the ported shell from hippo to Remora: name, placeholder logo, theme tokens, page titles,
   meta tags. Keep the UI kit (`components/ui`).
2. **Routes and page skeletons for the ship set,** driven by fixtures:
   - `/onboarding` (A6 wizard steps);
   - `/funds` with the **Detect funds** split view ("ready in address balance · in coins → Move",
     the settling state, Withdraw under Advanced; A4·ui);
   - `/remoras` and `/remoras/:id` (the activity feed skeleton, N1);
   - `/memory` (inspector table with hidden, expiry and used-in; F3·ui);
   - `/approvals` (N2);
   - a "Why?" drawer component (N4);
   - the panic button placement (N10);
   - a `/lab/*` slot left empty for Uy.

   Register every route in `apps/web/src/app/routes.tsx` (append-only).
3. **Copy keys v1:** fill `apps/server/src/copy/` with first-draft text for the keys in
   `packages/schema/copy-keys.ts` (bot messages, buttons, error sentences).
4. **E2E harness** in `e2e/`:
   - Playwright config;
   - an injected wallet-standard **test wallet** that reads a burner key from env (never committed);
   - a smoke test: the app loads, onboarding renders with fixtures, `/funds` shows the split;
   - a script `bun run e2e` (local) and `bun run e2e:main` (against the main deployment, used later).
5. **Docs:** `docs/e2e/README.md` (how to run, which env vars), plus `docs/ux/` notes for any UX decision
   (add an ADR if it changes a decision).

## Done when
- [ ] Typecheck, lint and test are green; `bun run e2e` passes locally against fixtures
- [ ] Every ship-set page above renders on desktop and mobile with fixture data
- [ ] Rebased and pushed to `main` (your own paths only), with screenshots posted to the team chat

## Never
- Edit backend code or `packages/schema` (request changes in a `docs/handoffs/` note or a contract PR).
- Commit the burner key.
- Use real owner accounts.
- Deploy.
