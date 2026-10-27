# Landed: Remora's web in openbot's UI (goal U13)

- **Date:** 2026-10-27
- **From:** Uy's agent (goal [U13](../goals/uy-13-openbot-ui.md),
  [ADR-0069](../adr/0069-openbot-ui-ported-under-polyform.md), [claim](2026-10-27-uy-to-huan-u13-claim.md))
- **To:** Huấn
- **Status:** landed on `main` through the U13 PR (see the PR for the diff and its checks)

The whole web now wears openbot's UI. The copy, routes, data, every e2e selector, your command
palette and your kit's Radix behaviour are unchanged. The rollback point is the tag `pre-u13-ui`.

## What changed, by layer
- **The license frame.** Code ported from openbot lives only in `apps/web/src/openbot/`, under
  PolyForm Noncommercial 1.0.0 with Synthetify Labs' Required Notices.
  - Its README maps each file to its upstream path, and every file has a header naming its source.
  - The rest of the repo stays MIT; the root README and `THIRD_PARTY_NOTICES.md` say so.
  - Please keep anything you derive from openbot in that folder, with the same header.
- **Tokens.** `openbot/tokens.css` has openbot's palette (light in `:root`, dark in `.dark`, so your
  theme switch still works), type, radii, control heights, motion and the neutral focus ring.
  - `index.css` points shadcn's variables at them. `primary` is openbot's inverted element (near-black
    on light, near-white on dark). openbot's blue is `ob-accent` / `ob-accent-text`, for links and
    information.
  - Inter Variable is the font (OFL, in the notices).
- **Your kit** (`components/ui`) keeps its Radix behaviour, `data-slot`s and props, with openbot's look:
  - buttons at 24/32/36/40px with a press scale;
  - pill badges, soft status tints, a 1px neutral focus ring, a light dialog overlay with a 4px blur;
  - sliding-pill tabs, menus on the control surface, the tooltip on the canvas colour;
  - bubbles at 22px radius.
- **The shell** (`app/app-layout.tsx`, `app-rail.tsx`, `app-sidebar.tsx`):
  - the page rail, then a card with the roster, the main pane and a docked side panel;
  - the roster is resizable and snaps to 88px of faces (Cmd/Ctrl+B also folds it), with sections
    Needs you / Remoras / Rooms / Chats and one search field;
  - the network and panic controls sit in the roster's top row, and move to the main pane's top row
    when the roster is folded or on a phone;
  - at 720px and below, one pane at a time and a bottom nav.
- **Slots for pages** (`app/shell.tsx`): `ShellHeaderStart`, `ShellHeaderEnd` and `ShellSidePanel`. Each
  renders in place when a page is mounted alone, so your page tests keep working. `docs/ux/README.md`
  has the short guide.
- **Conversations** (`/chat`, threads, rooms):
  - openbot's message entries, with faces and coloured names in rooms;
  - payments and learned rules as centred markers, approvals as interaction cards;
  - the steps of a turn under one summary line, typing dots, day markers;
  - openbot's composer.
  - Why? and Memory open in the side panel.
- **Your command palette** is drawn as openbot's global search. It now includes every rail page
  (Connections was missing), rooms and two actions; its keys and test ids are unchanged.
- **Pages** take openbot's page, settings and data-table style through the page components.

## Tests
- `app/pages.test.tsx`: the assertions on Tailwind classes now check behaviour or the new structure
  (the rail, the roster and its search, the side panel, the phone panes).
- `app/shell.test.tsx` is new. It covers the resizer (keys, drag, snap, reset), the side panel (open,
  close, hand-off between openers) and the phone nav.
- `e2e/tests/u13.spec.ts` is new: screenshots of every route at 1280 and 375 px, light and dark, plus
  Cmd/Ctrl+K, Tab order, reduced motion and the N18 labels. Every other spec runs unchanged.

## Yours to decide
- ADR-0036 and ADR-0039 are superseded on the look; their page-component rules still stand.
- ADR-0041 (the ASCII ocean) is still Proposed on your side. Its license question is settled (ADR-0068),
  and the ocean stays behind the empty `/chat`, recoloured.
- Copy is untouched. If any string reads wrong in the new layout, it's yours to change.
