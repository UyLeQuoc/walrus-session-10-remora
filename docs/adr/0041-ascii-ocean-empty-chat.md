# ADR-0041: ASCII ocean behind the empty chat, with liquid-glass composer and suggestions

- **Status:** Proposed
- **Date:** 2026-10-20
- **Deciders:** Huấn

## Context
The empty `/chat` page is the first thing a visitor sees, and it is a plain greeting plus a composer.
We want a showcase moment there that fits the remora theme. stackedlol's
[ascii-sharks](https://github.com/stackedlol/ascii-sharks) draws fish schools and hunting sharks as
ASCII on a canvas. It has zero dependencies, pauses off-screen and respects prefers-reduced-motion.

The repo has **no license file** (checked 2026-10-20, commit `c521e24`). Without one, the code is
all rights reserved by default.

## Decision
- Vendor the sim into `apps/web/src/components/ascii-ocean/` (engine, world, renderer, species,
  math) plus a React wrapper, `AsciiOcean`. Each file names the upstream source and commit.
- Changes from upstream: the canvas is transparent instead of black. The grid, fish and wake inks
  follow the `.dark` class. The no-swim zone is taller (H·0.34, up from H·0.16) so sharks keep off
  the greeting, composer and suggestions. The engine is skipped under jsdom.
- Render it only in the empty chat state, behind the content, with the centre faded by a radial
  mask. It unmounts with the first message.
- Add a `liquid-glass` utility (`index.css`): a translucent gradient, backdrop blur, and a bright rim.
  The empty-state composer and the suggestion chips use it.
- **Before this ships to the public deployment**, get a license (MIT or similar) or written
  permission from the author. Without one, remove the component.

## Consequences
- No new npm dependency, and it is about 2k lines of local code that we now maintain.
- Cost: one canvas animating at 60 fps on the empty chat only. It pauses when off-screen and stays
  still under reduced motion.
- Legal: this ADR stays Proposed until the license question is settled. Accept it once settled.

## Links
- [ADR-0036](0036-ui-foundation.md) (UI foundation), [ADR-0038](0038-home-dashboard-chat-route.md) (`/chat`)
- Upstream: https://github.com/stackedlol/ascii-sharks
