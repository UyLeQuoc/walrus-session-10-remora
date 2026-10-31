# ADR-0094: Plain words in the product; Disc, Wake, Reef and Sonar stay the names in code and docs

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy ("there's a lot of UI to fix, like the wording: I don't know what a Disc is"; chose
  "plain words in the UI"; applied by Uy's agent)

## Context
- **The product talks in our own names.** A person who opens the app reads:
  - **Disc** (~170 places), the onchain spending limit;
  - **Wake** (~120), the receipt for one action;
  - **Reef**, the directory of paid services;
  - **Sonar**, the policy check before a payment;
  - **Hatchery**, the shared templates; "hatch" means make your own copy;
  - **shadow mode**, where the remora runs but doesn't pay;
  - **anchored**, which means saved onchain.
- **N14 added tooltips for some of these words.** A tooltip explains a word only after the reader stops
  on it. Uy, who built the system, still asked what a Disc is.
- **The video is about to be re-shot.** Uy plans to polish the UI and record it in dark mode, so the
  wording should change before that.

## Decision
- **The product uses plain words.** That covers the web app, the server messages the app shows
  (activity, receipts, errors, notifications, bot replies), the landing page and the MCP verify line.

  | In code and docs | In the product |
  |---|---|
  | Disc | spending limit ("a $1 spending limit, enforced on Sui") |
  | Wake | receipt; "Wake id" becomes "receipt id" |
  | Reef | Services (the page), "paid services", "a listed service" |
  | Sonar | the safety check |
  | Hatchery / hatch | Templates; share as a template; use it, make your copy |
  | shadow mode, the `shadow` status | practice mode; the badge says "practice" |
  | anchored | saved onchain |

- **A payee shows by its name, not its id.**
  - `payeeName()` turns `reef:sui-risk` into "Sui risk check", and drops `reef:` from unknown ids.
  - It is used in:
    - the feed;
    - the playground;
    - Why?;
    - approvals;
    - the public proof;
    - the new-remora form;
    - the learning sources.
  - A template's review still lists the raw ids it names, since that is what the template declares.
- **The glossary keeps its tooltips under the new words:** spending limit, receipt, services, safety
  check, practice mode, address balance and sponsored gas.
- **What stays as it is:**
  - The names in code, the API, the database, error codes (`disc.payee_not_allowed`), events, routes
    (`/reef`, `/hatchery`) and the docs.
  - "Remora" itself, the product's word for an agent.
  - "Wakes" as a verb ("Wakes daily").
  - The LLM prompts.
- **Old rows keep their old words.** Activity and receipt reasons written before this change still
  read "Sonar" or "Disc"; new ones use the plain words.
- **The tests follow the words:**
  - web unit tests;
  - server tests (the safety-check reasons);
  - the e2e selectors: testnet, u6, u7, u8, u12 and demo, whose Scout question is now "Is the package
    0x… safe to depend on?".

## Consequences
- **A newcomer reads "spending limit" and "receipt",** not names they have to look up. The video
  re-shoot and the landing page tell the same story in the same words.
- **Two vocabularies to keep in mind.** Code and docs say Disc and Wake; the screen says spending limit
  and receipt. This ADR's table is the mapping. New UI copy follows the right-hand column.
- **The e2e suite needs a rerun on testnet** to confirm the new selectors. Unit tests, typecheck and
  lint pass.
- **Docs updated:**
  - `docs/remora-features.md` N14;
  - a handoff to Huấn, since the web app, e2e and the landing page are in his lane.

## Links
[ADR-0087](0087-uy-merges-additive-contract-prs.md) · [ADR-0092](0092-landing-page.md) ·
[ADR-0093](0093-demo-video-v2-walform-craft.md) ·
[handoff](../handoffs/2026-10-31-uy-to-huan-plain-words.md)
