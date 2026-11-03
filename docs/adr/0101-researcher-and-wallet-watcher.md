# ADR-0101: The two kinds of remora read "Researcher" and "Wallet watcher" in the product

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Uy Le (asked "did we change the wording? some words don't make sense, like scout,
  sentinel", and picked the names), Uy's agent

## Context
- [ADR-0094](0094-plain-words-in-the-product.md) put the product in plain words:
  - Disc became spending limit;
  - Wake became receipt;
  - Reef became Services;
  - Sonar became safety check;
  - Hatchery became Templates.
- **It kept the two template names, Scout and Sentinel.** They name what a remora is, and a newcomer
  can't guess either one.
- The app is live ([ADR-0099](0099-first-deploy-one-railway-service.md)), and the landing page opens
  it ([ADR-0100](0100-landing-and-app-one-site.md)). So these words are the first thing a judge reads.

## Decision
- **The product says:**

  | In code, the API and the docs | In the product |
  |---|---|
  | Scout (`scout`) | **Researcher**: answers your questions and buys the data it needs |
  | Sentinel (`sentinel`) | **Wallet watcher**: watches your wallets and tells you what matters |

- **That covers what people read:**
  - the web app;
  - the server messages the app and the bot show (the playground, errors, team import warnings,
    Templates);
  - the template names and personas, so a new remora is called "Researcher" or "Wallet watcher"
    unless you name it;
  - the Telegram menu: `/ask` and `/teach`. `/scout` still works;
  - the landing page;
  - the demo video's captions.
- **One helper per side.**
  - The web's `kindName()` (`apps/web/src/lib/kind.ts`) replaces the places that printed the raw
    slug: card bylines, the chat header, badges, Connections and the Templates filter.
  - The bot reads the names from `TEMPLATES`. Its `/remoras` list writes the kind only when the
    name differs from it.
- **What stays as it is:**
  - the slugs `scout` and `sentinel`;
  - the routes, error codes, team files (`template: scout`), the MCP tool arguments and the docs;
  - the LLM prompts;
  - remoras that already exist keep their names.
- **The tests follow the words:**
  - web unit tests;
  - the server runtime tests (default names, `@Wallet watcher` in a room);
  - the e2e selectors: smoke, w2, u8, u12 and demo.

## Consequences
- **A newcomer reads what each kind does,** not a name to look up.
- **Three vocabularies are now mapped:** this table and ADR-0094's. New copy uses the right-hand
  columns.
- **"Wallet watcher" has a space,** so an @mention is `@Wallet watcher`. Room routing already matches
  multi-word names.
- **The prose people read uses the new names too.**
  - That's the README's judge-facing parts, the blog, the submission and the post drafts.
  - The README's technical tables and build history keep the code names.
- **The video and the landing screens change with the next capture.**

## Links
- [ADR-0094](0094-plain-words-in-the-product.md) · [ADR-0095](0095-explain-the-app-in-the-app.md) ·
  [ADR-0100](0100-landing-and-app-one-site.md)
