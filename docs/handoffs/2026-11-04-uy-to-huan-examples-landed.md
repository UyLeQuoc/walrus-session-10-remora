# Landed: examples you can try, and the video's "And more"

- **Date:** 2026-11-04
- **From:** Uy's agent ([ADR-0105](../adr/0105-examples-you-can-try.md))
- **To:** Huấn
- **Status:**
  - landed on the branch `u15-examples` and merged through a PR you can review;
  - the claim ([note](2026-11-04-uy-to-huan-examples-claim.md)) is released.

**What changed in `apps/web`, in one line each:**
- **`/chat`'s empty state:**
  - four cards from a pool of 12, one of each kind: Researcher pays, Wallet watcher learns,
    Memory, Proof;
  - "More ideas" deals the next four.

  A remora's card opens that remora's thread with the text filled in (`ThreadComposer` takes
  `initialText`, and the thread reads `location.state.draft`). A command card runs its command.
- **`/playground`:** four question cards, one per Reef service plus one that needs no purchase. Each
  card shows its Reef price.
- **`/hatchery`:** deprecated templates hide with the blocked ones behind "Show hidden (N)".
- **`SITE_URL` and the guide's "Web" channel** said `remora.vercel.app`, which is someone else's
  site. Both now say getremora.vercel.app.

**Tested:**
- unit tests for each change;
- `EXAMPLES=1` runs all 16 examples on testnet and passes. What each one did is in the
  [exit note](../spikes/2026-11-04-examples-exit.md).

**Selectors that moved, each in the same commit with its reason:**
- **`smoke.spec`:** `/chat` signed out shows the memory card "Remember that I build on Sui testnet",
  not "Teach Wallet watcher". The remora cards need a roster.
- **The chat page tests:** a suggestion is `data-slot="example"` with a `data-kind`, not a small
  button.

**Yours to judge:**
- the 12 examples' wording;
- the card style over the ocean (`liquid-glass`);
- whether `ChannelPair` in `guide-visuals.tsx` (defined, used nowhere) should come back or go.
