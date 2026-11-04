# ADR-0105: Examples you can try: varied, tested, and routed to where they work

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Uy (asked for it), Uy's agent (the details)

## Context
Uy asked for more varied and more interesting examples, and for the video to show more of the
product. A look at the three places where the app suggests something to try found five problems:

- **The chat's four suggestions were grey lines,** and two of them didn't work where they appeared.
  - The chat at `/chat` has only `remember` and `recall`.
  - So "Ask Researcher: is package 0x2 safe…?" got an unpaid answer from general knowledge, and
    "Teach Wallet watcher: …" became a memory, not a rule.
  - A remora answers and learns in its own thread, `/chat/r/:id`.
- **The playground had two suggestions,** a Sui risk check and the odds. It never showed the third
  paid service (Brief) or what each one costs.
- **The template gallery** on the local stack was a wall of identical `Checker mv…` cards from
  `u7.spec` runs.
  - The gallery at getremora.vercel.app was empty: `GET /api/hatchery` returned
    `{"templates":[]}` on Nov 4.
  - So a judge who opened Templates saw nothing.
- **Deprecated templates still showed in the gallery,** with only a badge. They can't be used:
  hatching one fails with `hatchery.deprecated`.
- **The 161 s video showed about 20 of the 69 ship-set features.** Templates on Walrus, rooms,
  Claude Code and Telegram weren't on screen at all.

## Decision
- **Chat.** The suggestions are a grid of cards from a pool of about a dozen, four at a time, with
  "More ideas" to show the next set. Each card has:
  - a coloured icon for what it shows: pays for data, learns a rule, remembers, or proves;
  - one line of text.

  A card goes where it works:
  - **memory cards** fill the chat box;
  - **command cards** (`/whoami`, `/memory`, `/privacy`) run at once. They only read, and a filled
    `/` would open the command menu instead of sending.
  - **Researcher and Wallet watcher cards** open that remora's own thread with the text filled in.
    It's the account's first live one of that kind, and the cards for a kind you don't have are
    left out.
  - The reload card keeps its reload.
- **Playground.** Four question cards, each naming what it uses:
  - a Sui risk check;
  - the odds;
  - a Brief of a public page;
  - a free question answered from Sui reads.

  A paid card shows the service's price, read from the Reef. A price that hasn't loaded is left
  out, never guessed.
- **Every example is tested once on testnet** before it ships, by an opt-in spec
  (`EXAMPLES=1`, `e2e/tests/examples.spec.ts`) that runs each one in the real UI. An example that
  fails is changed or removed, not shipped.
- **Templates.**
  - **A curated set, published for real.** Six varied templates are published to Walrus through
    the Hatchery: one-remora Researchers and Wallet watchers, a two-remora team with a lead and a
    schedule, and rules in plain words.
    - They're published by the E2E burner, a test account, on testnet.
    - The opt-in spec `SEED=1` (`e2e/tests/seed.spec.ts`) does it, and a template already
      published under the same name is skipped.
  - **The test runs' templates are deprecated onchain** by their author, the burner, through the
    real deprecate transaction. `u7.spec` now deprecates the one it publishes, which also tests
    that path.
  - **The gallery hides deprecated templates** with the blocked ones, behind one
    "Show hidden (N)" toggle.
- **Video.** A new chapter, "08 · And more", recorded from the real app:
  - the template gallery;
  - a template's page (on Walrus, reviewed);
  - a room of remoras;
  - a new connection for Claude Code;
  - Telegram in Settings.

  It stays under 180 s, and every caption follows ADR-0103's rule.

- **Found while filming, and fixed:** the site's canonical URL (`SITE_URL`) and the guide's "Web"
  channel named `remora.vercel.app`. That domain is someone else's ("Remora Bank"). Both now name
  getremora.vercel.app, the site ADR-0099 and ADR-0100 set.

## Consequences
- **Rules unchanged:**
  - the chat examples now follow the product rules ADR-0101 and ADR-0042 (a remora's own thread) already set;
  - nothing on the server or in `packages/schema` changes.
- **Ownership:** the work is in Huấn's lane (`apps/web`, `e2e/`). It's claimed in
  `docs/handoffs/2026-11-04-uy-to-huan-examples-claim.md` and merged through a PR he can review.
- **The live gallery** fills only once the live API records the seeded templates. If its checkpoint
  indexer doesn't pick up the testnet publishes, the confirm calls against getremora.vercel.app are
  left for Uy's yes, with the deploy.
- **The video** is re-captured and re-rendered. The submission draft and the demo README follow.

## Links
- [ADR-0042](0042-grok-bots-shape.md)
- [ADR-0046](0046-hatchery-team-files-and-learning-shapes.md)
- [ADR-0101](0101-researcher-and-wallet-watcher.md)
- [ADR-0103](0103-visual-first-ui-pass.md)
- [ADR-0104](0104-visual-first-result.md)
- [the demo README](../launch/demo/README.md)
