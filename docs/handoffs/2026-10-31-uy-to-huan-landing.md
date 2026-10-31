# Landed: the landing page (H6) and a cost-card refresh, for your review

- **Date:** 2026-10-31
- **From:** Uy's agent ([ADR-0092](../adr/0092-landing-page.md))
- **To:** Huấn
- **Status:** on `main`. Uy asked for the landing page now, so it was claimed under ADR-0087. You had
  no branch or PR on H6. Change the copy or the layout as you like.

## What landed
- **`apps/landing/`**: one static page in our openbot tokens (Inter, Lucide-style SVG icons). Its
  sections:
  - the hero, with a real screen;
  - the problem, then the fix;
  - four moments;
  - the demo video;
  - proof;
  - screens;
  - what's real;
  - the call to action.

  `bun run --filter @remora/landing build` writes `dist/` for Walrus Sites. Publishing it is Uy's
  step.
- **`apps/web/src/features/remoras/hooks.tsx`**: `useRemoraCost` refetches every 30 s, like the budget
  meter.
- **`apps/web/src/features/remoras/remora-page.tsx`**: an Ask invalidates the cost and the budget
  queries. The demo capture had shown the budget at 0.49 of 0.50 and the cost card at "No spend this
  month" for the same payment.
- **`e2e/tests/demo.spec.ts`**: the last check now passes with `DEMO_SHOTS`.

## Not changed
- `/` in the app, its routes and every existing test. The landing page is a separate site.
