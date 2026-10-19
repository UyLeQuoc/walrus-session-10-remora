# UX notes (W1 web, U4 first drafts)

These are drafts by Uy's agent under ADR-0027. **Huấn owns the look and the voice**, so change
anything here. The UI was rebuilt under `docs/ux/ui-polish-plan.md` (ADRs 0036–0038).

- **The network lives in the header** ([ADR-0026](../adr/0026-network-switch.md),
  [ADR-0037](../adr/0037-network-dropdown.md)).
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
- **The panic button** (N10) is a small ghost icon in the header, visible whenever you're signed in.
  It opens a confirm naming how many remoras and Discs will stop; one confirmation pauses every
  remora plus every Disc on the network, including a Disc that is not attached to a remora. Each Disc
  row in Funds has its own Pause / Resume.
- **"Why?"** (N4) is a ghost button on any activity row that has a Wake. It opens a side sheet with
  the decision, reason, trigger, what was read, the memories used, the Sonar verdict, the model, the
  intent hash, and the transaction. An "anchored onchain" badge shows when `Paid.intent` matched.
- **Home is the dashboard, chat is `/chat`** ([ADR-0038](../adr/0038-home-dashboard-chat-route.md)).
  A new reader lands on the setup checklist; chat and memory are one click away.
- **Memory is one page, two tabs** (Remoras / Chat). "My memory" is the Chat tab at
  `/memory?tab=chat`.
- **Skeleton pages are honest:** disabled actions carry a tooltip naming the wave that brings them.
- **Brand:** the block "R" `Logo` component ([ADR-0040](../adr/0040-block-r-logo-and-trace.md):
  tones auto/primary/black/white, optional tile and word) and a single electric indigo primary on warm
  neutrals ([ADR-0039](../adr/0039-electric-indigo-primary.md), which supersedes the teal part of
  [ADR-0036](../adr/0036-ui-foundation.md)). The UI kit is shadcn, with two added badge/alert
  variants (`success`, `warning`).
