# ADR-0095: Explain the app in the app: what a remora is, five steps to start, every page, a labeled rail

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Uy ("is there a way to explain what this app is, what it's for, what it can do and
  what each page does? I don't get how to use it, what's a remora"; then "redo it and push to main";
  built by Uy's agent)

## Context
- **The app never says what a remora is.**
  - Signed-out Home has a slogan ("Always-on agents you own.") and a setup checklist.
  - The guide (`/guide`, N14) explains the parts (key, memory, budget, receipt), but not what you'd
    use a remora for, how to start, or what each page does.
- **The page rail is icons only, with a tooltip on hover.** Its pages (Approvals, Funds, Connections,
  Templates…) don't say what they're for until opened.
- **Uy, who built the backend, couldn't tell how to use it.** A judge or a first user has less
  context than that.
- **The plain words from [ADR-0094](0094-plain-words-in-the-product.md) apply** to anything new we
  write.

## Decision
- **A shared "What's a remora?" block** (`components/app/what-is-remora.tsx`):
  - One sentence: an AI agent that works for you around the clock, with its own key, a spending limit
    Sui enforces, memory you can read on Walrus, and a receipt for everything it does; it never holds
    your wallet.
  - The two kinds: Scout answers questions and buys the data it needs; Sentinel watches your wallets
    and never pays.
  - A link to the guide.
  - It shows on Home until you have a remora (signed out, or signed in with none) and at the top of
    the guide.
- **The guide leads with how to use it.** The order:
  1. What's a remora?
  2. Start in five steps:
     1. try Scout with no wallet;
     2. sign in;
     3. create a remora, which starts in practice mode;
     4. use it, with Why? and Go live;
     5. stay in control, with Approvals, Funds and Pause all.
  3. Every page: each rail page with one line on what it's for, plus Try Scout, Services and Status,
     which the rail doesn't list. Each one links to its page.
  4. Inside a remora, then the existing sections (memory, the budget, receipts, commands, Claude
     Code).
- **The rail shows each page's name under its icon.**
  - `PageRail` gains `labeled`, which makes it 68 px wide with 60×48 buttons and a 10 px label.
  - "How it works" shows as "Guide".
  - The accessible names and tooltips are unchanged, so tests and e2e selectors hold.
  - The phone layout keeps its bottom nav.
- **The Home dashboard** says what it shows ("Your remoras, what needs you, and what they did
  lately") and has a How it works button next to New remora.

## Consequences
- **A first visit reads what a remora is and how to try one** before signing in. Every page is one
  rail label away from its name.
- **The rail is 16 px wider,** so the main pane is 16 px narrower on desktop. The demo capture's
  coordinates change. The video is re-captured anyway (ADR-0096).
- **One more ported openbot file carries a Remora change** (`page-rail.tsx`, `shell.css`), marked as
  such under the PolyForm licence frame (ADR-0069).
- **A handoff to Huấn** covers this: it's the web app, his lane under ADR-0087.

## Links
[ADR-0069](0069-openbot-ui-ported-under-polyform.md) · [ADR-0087](0087-uy-merges-additive-contract-prs.md) ·
[ADR-0094](0094-plain-words-in-the-product.md) ·
[handoff](../handoffs/2026-11-01-uy-to-huan-explain-the-app.md)
