# Landed: the app explains itself (what's a remora, five steps, every page, a labeled rail)

- **Date:** 2026-11-01
- **From:** Uy's agent ([ADR-0095](../adr/0095-explain-the-app-in-the-app.md))
- **To:** Huấn
- **Status:** on `main`. Uy couldn't tell what a remora is or what each page does, and asked for it.
  These web edits are follow-ups under ADR-0087.

## What changed in your lane
- **New `components/app/what-is-remora.tsx`** ("What's a remora?" plus Scout and Sentinel). It shows
  on Home until there's a remora, and at the top of `/guide`.
- **`/guide` order:**
  1. What's a remora?;
  2. Start in five steps;
  3. Every page, with one line each and a link;
  4. Inside a remora;
  5. the sections that were already there.
- **The rail shows labels under the icons:**
  - `PageRail labeled` and `.window-rail-labeled` in `openbot/shell/shell.css`;
  - "How it works" shows as "Guide";
  - aria labels and tooltips are unchanged.
- **The Home dashboard's description says what it shows,** and it has a How it works button.
- **A new test in `app/pages.test.tsx`:** the guide shows the block, the 5 steps and every page's
  link.

## To check
- **The phone layout** is unchanged (the bottom nav). Tell me if you want labels there too.
- **New pages** need a line in the guide's `PAGE_HELP`.
