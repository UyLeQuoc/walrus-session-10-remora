# ADR-0102: Landing page v2: a dark page around a live WebGL sea, with the app's faces swimming in it

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Uy Le (asked for a landing page that wows, "like shaders.com"), Uy's agent

## Context
- [ADR-0092](0092-landing-page.md) built the landing page in the app's light design system.
  - It read clearly.
  - It looked like a product page, not a launch.
- Since [ADR-0100](0100-landing-and-app-one-site.md), it's the first thing a signed-out visitor sees at
  <https://getremora.vercel.app>, a judge included.
- Uy pointed at shaders.com as the bar. Its traits:
  - a near-black canvas;
  - very large, tight white headlines;
  - live shader canvases in vivid colour;
  - the product shown in dark frames;
  - dark cards with mono labels.

## Decision
- **The page is dark.** It has its own tokens, apart from the app's:
  - near-black `#07070b`;
  - Remora's indigo, Sui blue, Walrus teal, and pink and amber accents.
- **Type:**
  - Inter Tight for headlines (`-0.045em`);
  - Inter for body text;
  - JetBrains Mono for labels.
  - All three load from Google Fonts.
- **The hero is a live sea: a fragment shader written for this page.** It uses no library and plain
  WebGL 1:
  - domain-warped noise in Remora's colours;
  - light shafts and caustics, plus a CSS grain;
  - it follows the pointer;
  - it draws at about half resolution, since it's blurry anyway, and CSS scales it up;
  - it pauses off screen and in a hidden tab.
  - A second canvas runs under the closing call to action.
- **A school of remoras swims through the hero.** They're the app's own faces (ADR-0098: five shapes,
  the dark-theme tints, blinking eyes).
  - The big ones keep to the top and bottom lanes. The ones that cross the words are small, far and
    faint.
  - On a phone they're half size and stay at the edges.
- **The real app sits under the hero in a dark browser frame.** It has a breathing glow and three
  glass callouts: the x402 payment, the rule learned, the verified receipt.
- **The sections keep ADR-0092's content and numbers, restyled:**
  - "Built on" wordmarks;
  - the problem and the fix as dark cards, each with a small live illustration: the spending-limit
    meter, the struck-through injection, the memory blobs;
  - four moments;
  - the demo video in a glowing frame;
  - the proof in big gradient numerals;
  - the screens and "what's real".
- **Accessibility and fallbacks:**
  - Under `prefers-reduced-motion`, the shader draws one frame, the fish are gone and nothing animates.
  - Without WebGL, CSS gradients stand in.
  - Focus rings show, contrast stays high on dark, and nothing scrolls sideways at 375 px.

## Consequences
- **The first screen does the job a launch needs,** and the faces tie it to the app.
- **The page and the app now look different on purpose:** dark and showy outside, calm inside.
- **The fonts come from Google, and the shader costs some GPU while it's on screen.** It's capped at
  1.5× device pixels times 0.55, and it stops off screen.
- **The landing smoke test still holds:** the `h1`, the playground link, and no sideways scroll.

## Links
- [ADR-0092](0092-landing-page.md) · [ADR-0098](0098-remora-faces-with-moods.md) ·
  [ADR-0100](0100-landing-and-app-one-site.md) · [apps/landing](../../apps/landing/README.md)
