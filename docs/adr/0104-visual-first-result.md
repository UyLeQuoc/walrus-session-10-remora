# ADR-0104: What the visual-first pass changed (U14 exit)

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Uy's agent (goal U14 run under [ADR-0103](0103-visual-first-ui-pass.md))

## Context
- [ADR-0103](0103-visual-first-ui-pass.md) set the pass: fewer words, data as pictures, three rounds,
  each with a fresh reviewer.
- Four rounds of review ran, with their notes in [`docs/ux/review/`](../ux/review/README.md).
- The reviewers asked for changes that alter what earlier ADRs decided. This ADR records those
  changes. It supersedes the parts named below, and leaves the rest of those ADRs as they were.

## Decision
- **"What's a remora?"** (partly supersedes [ADR-0095](0095-explain-the-app-in-the-app.md)).
  - The block is one line ("An AI agent with a budget it can't break."), a five-node `MoneyFlow`
    (your wallet → spending limit → remora → paid service → receipt), the two kinds as tiles, and
    the faces.
  - The full sentence and each kind's detail are behind `?` hints. Every hint links to the guide.
  - Signed in with no remora yet, Home leads with the setup checklist; signed out, it leads with the
    block.
- **Home** (partly supersedes ADR-0095). Home has:
  - three numbers (remoras, waiting for you, ready to spend);
  - six remora cards and "See all";
  - eight events, grouped by day.

  Its How it works button is gone; the rail's Guide and the hints do that job.
- **`/remoras` is the list.** It has a kind filter and no activity feed, since Home has the feed. The
  approvals banner is gone too; Home's "Waiting for you", the roster and the rail's badge carry it.
- **The phone's bottom bar** (supersedes the bottom-bar part of
  [ADR-0070](0070-u13-openbot-ui-implementation.md)).
  - It holds Home, Chat, Approvals (with its count), Funds and More, each an icon over a label.
  - More opens the roster with a grid of the other pages.
  - It used to hold "Remoras" and "Page", which left Funds, Memory and Settings out of reach on a
    phone.
- **One unit for money: USDC.** Funds and Home show balances as "19.78 USDC", not "$19.78". The
  playground says "1 USDC limit".
- **The states of a spending limit:**
  - **Being read:** a pulsing track.
  - **Read:** a meter.
  - **Unreadable:** the API failed.
  - **Gone onchain:** the server answers `meter: null` after a successful read. The remora "can't
    spend", the header and cards say so, Keys marks the Disc "revoked", and the change form hides,
    because changing a budget revokes the old Disc and reissues it.
- **The feed's "Blocked"** is kept for a guard: the safety check, the cap, the remora's state or a
  Move abort. A purchase a service didn't deliver "didn't go through, nothing paid", in grey.
- **Agent text** renders without `<untrusted>` wrappers, and long hex ids in titles read
  `0xcc05…5d6d`.
- **Receipts** lead with a receipt card. Verify's checks read in plain words, with the server's names
  as tooltips. The timing check says "It decided as it paid" (the server allows 5 s of skew).
- **Status** groups its parts in plain names, says what a problem means, and shows when it was
  checked.
- **Memory's index check** counts writes skipped as duplicates as found, not missing.

## Consequences
- The kit and its rules are in [docs/ux/README.md](../ux/README.md). New pages build on them.
- The e2e specs changed where their texts did, each in the same commit with its reason:
  - `testnet` reads the balance in USDC;
  - `demo` boxes the playground's receipt card;
  - `u6` reads the plain room routes.
- **Data the reviewers wanted that the API doesn't return,** for later:
  - a memory row's text, without searching;
  - a public receipt to try Verify with;
  - when a status problem started;
  - a way to issue a new Disc for a remora whose Disc is gone.

## Links
- [ADR-0103](0103-visual-first-ui-pass.md) · [ADR-0095](0095-explain-the-app-in-the-app.md) ·
  [ADR-0070](0070-u13-openbot-ui-implementation.md) · [review notes](../ux/review/README.md)
