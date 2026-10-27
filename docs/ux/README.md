# UX notes

The web wears **openbot's UI** since U13 ([ADR-0069](../adr/0069-openbot-ui-ported-under-polyform.md)):
its palette, type and density, its shell, its conversation and its page style, ported to React.
The ported code lives only in `apps/web/src/openbot/` under **PolyForm Noncommercial 1.0.0**, with its
own `LICENSE` and a file map in its README. Remora's pages, data, copy, logo and avatars stay MIT.
**Huấn owns the look and the voice**, so change anything here. The notes from U4 and the polish plan
(`ui-polish-plan.md`, ADRs 0036–0038) still describe behaviour; where the look differs, ADR-0069 wins.

## Building a page in the new kit
- **Use the kit, not raw colours.** `components/ui/*` are shadcn primitives restyled to openbot's: 36px
  default buttons (the default variant is the inverted surface), 32px small ones, a neutral 1px focus
  ring, 22px pill badges, 14px cards. shadcn's variables point at openbot's tokens, so `bg-card`,
  `text-muted-foreground` and friends are already right.
- **openbot's own names**, for what shadcn has no word for, are Tailwind colours prefixed `ob-`:
  `bg-ob-control`, `bg-ob-control-hover`, `bg-ob-surface`, `border-ob-border`, `text-ob-muted`,
  `text-ob-secondary`, `text-ob-accent-text` (openbot's blue, for links and info), `bg-ob-success-soft`
  with `text-ob-success-text`, the same for `warning` and `danger`. Radii: `rounded-ob-card` (14),
  `rounded-ob-grouped` (16), `rounded-ob-bubble` (22). Type: `text-md` is 13px.
- **The page frame is still `Page` / `PageColumn` / `PageHeader` / `Section`** (`components/app`). Only
  `Page` sets width, gutter and the document title, so every `h1` keeps one left edge (the e2e checks it).
- **The shell gives a page three slots** (`app/shell.tsx`):
  - `ShellHeaderStart`: replaces the top row's title (a chat puts its face, name and status there);
  - `ShellHeaderEnd`: adds controls before the network and panic controls;
  - `ShellSidePanel`: shows content in the docked right panel (Why?, Memory), a full-screen pane on a
    phone. The last opener gets the panel; the one it replaces is told it closed.

  Each renders in place when the page is mounted without the shell, so unit tests keep working.
- **Conversations** use `@/openbot`'s `ConversationScroll`, `MessageEntry` (face, coloured name, bubble,
  action row), `ChatActionMarker` (payments, learned rules), `AgentSteps` (what a turn did),
  `InteractionCard` (approvals), `AgentActivity` (typing dots) and `Composer`. Bubbles are the kit's
  `Bubble`: `secondary` for the owner, `muted` for a remora, `tinted` for a ping.
- **Faces** are Remora's own `RemoraAvatar` (an initial on a tint picked from the id). openbot's blob
  faces, logo and artwork are its brand and are not ported.
- **Anything new derived from openbot code** goes in `apps/web/src/openbot/` with the header
  `Ported from nightly-labs/openbot <path> @ aa3c498. PolyForm Noncommercial 1.0.0, see ./LICENSE.`
  and a row in its README.

## Behaviour notes
- **The network lives in the roster's top row** ([ADR-0026](../adr/0026-network-switch.md),
  [ADR-0037](../adr/0037-network-dropdown.md)). When the roster is folded to faces, or on a phone, it
  moves to the main pane's top row, so it is always in view.
  - One 32px dropdown shows a status dot, the network name and a chevron. A warning dot and the word
    "Testnet" are always visible, so nobody mistakes test money for real money.
  - Unavailable networks are disabled in the menu, with the reason under the name ("Not published
    yet").
- **The wallet mismatch shows as a warning `Alert` inside the page, not a banner across the header.**
  It names the network the wallet is on and the one to switch to. Signing is still possible; the
  wallet refuses on its own.
- **Funds speaks in two buckets:**
  - "Ready to spend" is the address balance remoras can spend;
  - "In coins" is what they can't spend yet; the tile offers **Move $X to ready** only when there is
    something to move, and shows "✓ Nothing to move" when there isn't.
  - "Withdraw to a coin" sits under **Advanced** at the bottom of the page, because almost nobody
    needs it.
  - After a move the Ready tile shows a "Settling…" badge until the balance updates (it's final
    within seconds).
- **The panic button** (N10) is a small danger pill next to the network, visible whenever you're signed in.
  It opens a confirm naming how many remoras and Discs will stop; one confirmation pauses every
  remora plus every Disc on the network, including a Disc that is not attached to a remora. Each Disc
  row in Funds has its own Pause / Resume.
- **"Why?"** (N4) is a ghost button on any activity row that has a Wake. In the app it opens the docked
  side panel (a sheet when a page is shown alone) with
  the decision, reason, trigger, what was read, the memories used, the Sonar verdict, the model, the
  intent hash, and the transaction. An "anchored onchain" badge shows when `Paid.intent` matched.
- **Home is the dashboard, chat is `/chat`** ([ADR-0038](../adr/0038-home-dashboard-chat-route.md)).
  A new reader lands on the setup checklist; chat and memory are one click away.
- **Memory is one page, two tabs** (Remoras / Chat). "My memory" is the Chat tab at
  `/memory?tab=chat`.
- **Skeleton pages are honest:** disabled actions carry a tooltip naming the wave that brings them.
- **Brand:** the block "R" `Logo` component ([ADR-0040](../adr/0040-block-r-logo-and-trace.md):
  tones auto/primary/black/white, optional tile and word) on openbot's neutral palette, with openbot's
  blue for links and information ([ADR-0069](../adr/0069-openbot-ui-ported-under-polyform.md), which
  supersedes [ADR-0036](../adr/0036-ui-foundation.md) and [ADR-0039](../adr/0039-electric-indigo-primary.md)
  on the look). The UI kit is shadcn, restyled, with `success` and `warning` badge/alert variants.
