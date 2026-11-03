# ADR-0092: A static landing page (H6), built for Walrus Sites; the cost card reads a payment at once

- **Status:** Accepted; the page's **look** (the app's light design system) is superseded by [ADR-0102](0102-landing-v2-live-shader.md)
- **Date:** 2026-10-31
- **Deciders:** Uy (asked "is there a landing page? finish it"; built by Uy's agent)

## Context
- **H6 is still open.** H6 is a landing page and docs on Walrus Sites, in Huấn's lane, planned in
  U10 with "Huấn builds the static landing".
- **The only front door was inside the app.** Signed out, Home shows the setup checklist inside the app
  shell, which isn't a landing page for judges or for X.
- **Uy asked for it now.** Under [ADR-0087](0087-uy-merges-additive-contract-prs.md), the agent takes it.
  Huấn had no branch or PR on it.
- **The demo capture (ADR-0091) surfaced two bugs:**
  - **The cost card didn't refresh after a paid answer.** `useRemoraCost` had no refetch interval, and
    nothing invalidated it after an ask. The budget meter polls, so the two disagreed: 0.49 left, but
    "No spend this month".
  - **`listOwnerDiscs` threw when a cap's allowance was gone,** which happens with a revoked and deleted
    Disc. That failed the e2e global setup. Its own doc says such allowances "drop out".

## Decision
- **`apps/landing`: a static page, no framework.**
  - It's in the app's design system: openbot tokens, Inter, Lucide-style SVG icons.
  - Sections:
    - a hero with a real screen (Scout · demo after a paid answer) and SVG callouts;
    - the problem, then the fix;
    - four moments;
    - the real-app demo video;
    - proof: 360 memories, 0 in 28, 12 Tatum calls, 0.01 USDC, 25.3 s, and the onchain abort linked
      to Suiscan;
    - real screens;
    - what's real, what isn't;
    - the stack;
    - a final call to action.
  - It is responsive. There is no horizontal scroll at 1440 or 390 px, and it respects reduced
    motion.
  - `public/config.js` holds the only deploy-time values: the app's URL and the blog's. Until the app
    is deployed, the CTAs fall back to the repo's "Try it".
- **The build.** `bun run --filter @remora/landing build` writes `dist/`:
  - the page and the screens;
  - the share image;
  - `ws-resources.json` for Walrus Sites;
  - the demo video and its poster, when `docs/launch/demo` has rendered them.
- **Publishing to Walrus Sites (mainnet, costs WAL) is Uy's step,** like any deploy. The commands are in
  `apps/landing/README.md`.
- **`apps/landing/public` is excluded from Biome,** like `apps/web/public`. Its decorative SVGs carry
  `aria-hidden`, and a `<title>` would show as a tooltip.
- **The cost card reads a payment at once.**
  - `useRemoraCost` refetches every 30 s, like the budget meter.
  - An answer from the Ask card invalidates both the cost and the budget queries.
  - Re-captured: the card shows $0.02 (model, sponsored gas, purchases) right after the answer.
- **`listOwnerDiscs` skips a cap whose allowance is not found,** with a test. Other errors still throw.
- **The demo spec's last check** asks for the shots requested, so `DEMO_SHOTS` runs pass.

## Consequences
- **There's a landing page to link from the form, the README and the posts** once it's published. The
  app stays unchanged at `/`, so no e2e test moves.
- **The page needs a few edits at deploy:**
  - `config.js` (the app's and the blog's URLs);
  - the Walrus Sites publish;
  - optionally a SuiNS name.
- **The cost card and the budget meter agree.** The global setup survives a vanished allowance.

## Links
- [docs/remora-features.md](../remora-features.md) H6 · [ADR-0091](0091-real-app-demo-video.md) ·
  [apps/landing/README.md](../../apps/landing/README.md) ·
  [handoff](../handoffs/2026-10-31-uy-to-huan-landing.md)
