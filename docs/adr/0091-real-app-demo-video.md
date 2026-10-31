# ADR-0091: The demo video shows the real app, told as problem → fix

- **Status:** Accepted (its edit and render are superseded by [ADR-0093](0093-demo-video-v2-walform-craft.md); the capture stands)
- **Date:** 2026-10-31
- **Deciders:** Uy (asked for "a demo of the real app, real UI, problem and solution, SVG, prettier,
  in the app's design system"; built by Uy's agent)

## Context
- **The showreel ([ADR-0090](0090-motion-graphics-showreel.md)) is motion graphics.** Uy wants the
  form's video to show the real app: real screens, real clicks, real onchain results. It should be
  framed as the problem each part solves.
- **The real stack already runs end to end on testnet** (ADR-0088, ADR-0089). The e2e harness:
  - starts the server, facilitator, merchants and web;
  - signs with the burner wallet;
  - can drive any flow.
- **The deploy (U9 Phase D) hasn't happened.** A screen capture of a deployed URL isn't possible yet.

## Decision
- **Capture the real app with the e2e harness.**
  - A new opt-in project, `DEMO=1 … --project=demo` (`e2e/tests/demo.spec.ts`), runs the shots:
    1. **playground:** no wallet → $1 Disc → a paid answer → verify;
    2. **signin**;
    3. **create:** a Scout with its Disc, from one signature → Go live;
    4. **scout:** a paid answer on its own Disc → budget → Why?;
    5. **teach:** a Sentinel rule → Learning;
    6. **memory**;
    7. **approvals**;
    8. **funds**;
    9. **reef/status**.
  - Each shot records CDP screencast frames and a manifest of what happened when: cursor moves,
    clicks and marks.
  - `DEMO_SHOTS=a,b` re-records only those shots.
  - A full capture spends a few cents of testnet USDC.
- **The capture makes a fresh Scout.** The suite's global setup revokes leftover Discs, and a revoked
  Disc can't pay. The demo found that on its first run: the answer said `allowance.revoked`, which is
  ADR-0088's honest note at work.
- **Edit and render from code** (`docs/launch/demo/demo.html`, `render.ts`).
  - The footage plays in a window. Its segments are cut by the capture's own marks, so a re-capture
    needs no re-timing. Waits on the chain play sped up, under a badge that says so.
  - The left column tells each scene as **The problem → The fix**, with a checklist that ticks when
    the real event happens.
  - **SVG** draws:
    - the cursor and click ripples;
    - rings and callouts on the real elements;
    - the problem cards;
    - the injection diagram, with three layers.
  - **Design system:** the app's openbot tokens. Canvas `#f5f5f6`, white sheets with hairline borders,
    ink `#141414`, accent `#007cf7`, success, warning and danger, radii 14/16/20, Inter, Lucide-style
    icons.
  - **Sound:** a calm synthesised bed, a tick on every real click, a chime when a step checks out.
  - The output is 1080p30 H.264/AAC at −14 LUFS, plus a ~40 MB web copy.
- **Truthfulness.**
  - Every screen is the app as it ran.
  - Callouts say only what the screen shows:
    - the playground's Wake is "Verified · not anchored", so the callout says it matches the chain,
      not that it's anchored;
    - the new Scout's cost card still read "No spend this month", so the checklist cites the budget
      meter (0.49 of 0.50 left);
    - Proof of Learning had nothing yet, so the step cites the noise rate.

## Consequences
- **The form gets a demo of the working product today.** It is re-recordable in about 3 minutes and
  re-renderable in about 6.
- **After the deploy,** the same spec can run against the deployed URL (`E2E_BASE_URL`) if the
  playground and burner are configured there.
- **The capture surfaced one gap:** the cost card lags behind a payment that the budget meter already
  shows. It's noted for U9.

## Links
- [ADR-0090](0090-motion-graphics-showreel.md) · [ADR-0088](0088-ux-pass-after-full-e2e.md) ·
  [ADR-0087](0087-uy-merges-additive-contract-prs.md) (web and e2e follow-ups) ·
  [docs/launch/demo/README.md](../launch/demo/README.md)
