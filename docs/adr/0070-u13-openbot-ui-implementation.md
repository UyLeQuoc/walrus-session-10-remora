# ADR-0070: How U13 put openbot's UI on Remora: tokens over classes, shell slots, a docked side panel

- **Status:** Accepted
- **Date:** 2026-10-27
- **Deciders:** Uy (goal U13, run by Uy's agent)

## Context
[ADR-0069](0069-openbot-ui-ported-under-polyform.md) decided to port openbot's UI into Remora's web
and keep the ported code in `apps/web/src/openbot/`. Building it raised choices ADR-0069 doesn't
settle:
- openbot styles everything with about 50k lines of semantic CSS. Remora's kit is shadcn with Tailwind
  utilities, and pages override the kit with utilities.
- Pages need to put things in the shell (a chat's heading, the Why? receipt, the memory panel).
- e2e and unit tests pin text, roles and some layout.

## Decision
- **Tokens over classes for the kit.**
  - openbot's tokens (`openbot/tokens.css`) and Tailwind names (`openbot/theme.css`, `ob-*`) feed shadcn's
    variables in `index.css`.
  - `components/ui/*` keep their structure and take openbot's sizes, radii and colours through those
    tokens.
  - openbot's own CSS is ported only for what the kit has no part for: the shell, the conversation,
    the global search, and the page pieces in `openbot/pages/`.
  - The ported CSS sits in `@layer components`, so a page's utilities still override it.
- **The shell has three slots** (`app/shell.tsx`):
  - `ShellHeaderStart` and `ShellHeaderEnd` for the top row;
  - `ShellSidePanel` for the docked right panel, a full pane on a phone. The last opener owns it and
    the replaced one is told it closed.

  Each renders in place without the shell, so a page mounted alone in a test still shows its
  controls.
- **Why? and the chat's Memory panel open in the side panel**, not a sheet or an overlay. Alone (no
  shell) they keep the sheet.
- **A remora's answer sits in a bubble** (openbot's `muted` surface), the owner's in the `secondary`
  one. A ping is `tinted`.
- **A turn's steps start open** under openbot's summary line. What a remora recalled and saved is the
  proof of its memory, so it stays visible, and the person can fold it.
- **The network and panic controls follow the roster.** They sit in its top row, and move to the main
  pane's top row when the roster is folded or on a phone. Exactly one `testnet-badge` exists at a time.
- **On a phone the roster mounts only in its own pane.** Nothing hidden repeats the page's text or
  controls, and the bottom nav names the main pane "Page", not the page's title.
- **The sign-in state keeps its `h1` at the page's left edge.** openbot's centred login card sits
  below it, so the 1440px left-edge check holds.
- **The page gutter is openbot's: 16px, then 32px from `md`.** `Page` is still the only place that
  sets it.
- **The U13 spec sends its own client address per run** (`x-forwarded-for`). A full screenshot set
  makes hundreds of reads, and the local server's per-address limit (200 an hour, `iplimit.ts`)
  would refuse the sign-in halfway. The limit itself is unchanged.

## Consequences
- shadcn upgrades stay mostly mechanical: the kit's files changed only in class strings.
- A page that wants the side panel or the top row uses the slots. Nothing else reaches into the shell.
- Unit tests that asserted Tailwind classes were rewritten to assert roles, slots and behaviour.
  `app/shell.test.tsx` covers the resizer, the panel hand-off and the phone nav.
- The side panel fixed a bug while it was tested: a second opener used to close itself on its first
  frame.

## Links
- ADR-0069; [Goal U13](../goals/uy-13-openbot-ui.md); [UX notes](../ux/README.md)
- `apps/web/src/openbot/README.md` (the file map)
