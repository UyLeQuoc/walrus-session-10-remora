# ADR-0096: The demo video is re-shot in dark mode, with the plain words, and spotlights follow recorded boxes

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Uy ("polish the UI, then redo the video in dark mode"; then "redo it, push to main,
  then update the video"; built by Uy's agent)

## Context
- **The v2 video (ADR-0093) was shot before two UI changes.** Its footage and captions said Disc,
  Wake, Sonar and Reef. [ADR-0094](0094-plain-words-in-the-product.md) changed the product's words,
  and [ADR-0095](0095-explain-the-app-in-the-app.md) added "What's a remora?" and widened the rail.
- **Uy wants the video in dark mode.**
- **The spotlights used hand-measured rectangles.** A wider rail moves every element, so each
  re-capture meant re-measuring.
- **The last capture missed two marks.** "Pay once" and "Pause all" were checked with `isVisible()`,
  which doesn't wait, so they weren't recorded.

## Decision
- **`demo.spec.ts` films the dark theme.**
  - `DEMO_THEME=light` films the light one instead.
  - It sets `remora.theme` and the colour scheme before the page loads, and the manifest records
    the theme.
- **The capture records where things are.**
  - `s.box(label, ...locators)` stores the union of their boxes in CSS px.
  - Every labelled `s.to` and `s.click` stores its element's box too.
  - New boxes:
    - "What's a remora?";
    - the issued $1 limit;
    - the paid line;
    - the verify verdict;
    - practice mode;
    - the answer;
    - the cost card;
    - the receipt drawer;
    - the learned and ignored rows;
    - the approval card;
    - the budgets.
  - The video's spots name a box (`box: "cost-card"`) instead of a rectangle, and a missing box logs
    a warning when rendering.
- **Waits, not glances.**
  - A `shows(locator, ms)` helper waits for an optional element before the shot decides to film it.
  - The approvals and funds shots now record "Pay once" and "Pause all".
  - Their steps use those marks again.
- **`demo.html` uses the app's dark tokens** (openbot `.dark`), from the canvas, cards, HUD, step
  tracker, captions and badge to the diagrams. The brand violet lifts to `#8379ff` to read on black.
- **The words follow ADR-0094:**
  - a $1 spending limit;
  - within its limit;
  - its receipt;
  - the safety check;
  - a paid service;
  - practice mode.
- **The playground chapter opens on Home's "What's a remora?"**, with its own step and caption.
- **Each chapter's footage starts at its first mark, once its page has loaded.** A shot starts
  recording before it navigates, so its frame 0 is still the previous page. v2 showed that page for
  about a second under the new chapter's title.
- **The receipt drawer keeps a fixed rect.** It is a docked panel, not a dialog, so it has no recorded
  box. Its step and caption start at the Why? click.
- **The video runs about 169 s.**

## Consequences
- **The form's video matches the app** a judge opens: dark, the same words, the new rail.
- **A re-capture after a UI change keeps its spotlights** as long as the locators still match.
- **A capture spends a few cents of testnet USDC** from the burner, as before (ADR-0091).
- **The local UI stack and the capture both use 8797–8799/5183,** so one has to stop while the other
  runs.

## Links
[ADR-0091](0091-real-app-demo-video.md) · [ADR-0093](0093-demo-video-v2-walform-craft.md) ·
[ADR-0094](0094-plain-words-in-the-product.md) · [ADR-0095](0095-explain-the-app-in-the-app.md) ·
[docs/launch/demo/README.md](../launch/demo/README.md)
