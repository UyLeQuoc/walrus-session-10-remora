# ADR-0069: Remora's web takes openbot's UI, ported under PolyForm Noncommercial in its own folder

- **Status:** Accepted
- **Date:** 2026-10-27
- **Deciders:** Uy

## Context
Uy wants the UI of [openbot](https://github.com/nightly-labs/openbot) for Remora: "đem UI qua để xài
remora", then "fully UI trước" (the whole UI, before U9). openbot is a local-first workspace for AI
teammates, with a desktop app and a web client. It has a roster of agents, rooms, a chat timeline and
approval cards, which is close to Remora's shape since [ADR-0042](0042-grok-bots-shape.md).

Facts checked on Oct 27 (clone at `reference/openbot`, upstream commit `aa3c498`):
- **License:** PolyForm Noncommercial 1.0.0 since Aug 20, 2026. It was Apache-2.0 only from Aug 12 to
  Aug 20, and the code was already SolidJS then.
  - Use is allowed only for noncommercial purposes.
  - Copies must carry the terms and two "Required Notice" lines.
  - Sublicensing is not allowed.
- **Stack:** Electron + SolidJS 2 + Kobalte. The styling is about 50k lines of plain CSS with semantic
  class names; Tailwind is used only for its reset. Every component has to be rewritten in React anyway.
- **Remora is MIT** ([ADR-0068](0068-mit-license.md)).
- **The event rules** ([event-rules.md §5](../event-rules.md)):
  - a submission must be "your original work (or work you are authorized to submit)";
  - entrants grant the Sponsors a license to review, demo and showcase the work "for Hackathon and
    marketing purposes";
  - Creativity (20%) scores original ideas.
- **Options put to Uy:**
  - rebuild the look in our own code (recommended);
  - copy OpenMausBot's UI (Apache-2.0, React 19);
  - ask Synthetify Labs for a license.

  Uy chose to port anyway: "thi hackathon nên lấy UI đi" and "remora không chạy mainnet".

## Decision
- **Port openbot's web UI into Remora's web, in React,** pinned at upstream `aa3c498`. That covers:
  - the tokens (light and dark), type, radii, density, motion and focus;
  - the look of the primitives;
  - the shell (rail, roster, main pane, docked right panel, phone layout);
  - the conversation, the composer and the panels.
- **The ported code lives only in `apps/web/src/openbot/`.**
  - That folder has its own `LICENSE`: the PolyForm Noncommercial 1.0.0 text plus both Required Notice
    lines, verbatim.
  - Its `README.md` maps each file to its upstream path.
  - Each file starts with a comment naming its upstream source.
  - Remora's pages, data layer and everything else stay MIT. The root README and
    `THIRD_PARTY_NOTICES.md` say which folder is under which license.
- **Not taken from openbot:**
  - its brand: logo, wordmark, app icons, the blob avatars (bloub) and marketing art;
  - third-party marks (provider logos, Font Awesome brand icons);
  - its i18n copy;
  - the Electron and desktop-only pieces;
  - the stores and controllers, which talk to Electron.

  Remora keeps its own logo ([ADR-0040](0040-block-r-logo-and-trace.md)), its own avatars and its own copy.
- **Remora's behaviour stays.** The data layer, `routes.tsx`, `lib/api.ts`, the hooks, the copy and every
  e2e test id, label and role name stay.
- **This supersedes [ADR-0036](0036-ui-foundation.md) and [ADR-0039](0039-electric-indigo-primary.md) on
  the visual design.**
  - ADR-0036's page components remain, restyled.
  - The ASCII ocean of [ADR-0041](0041-ascii-ocean-empty-chat.md) stays behind the empty `/chat`,
    recoloured with the new tokens.
- **The work and its review:**
  - Uy's agent claims `apps/web` from Huấn ([ADR-0027](0027-flex-takeover.md)).
  - It works on a branch and opens a PR for Huấn's review, merging when green.
  - The tag `pre-u13-ui` marks the last commit before the port, as a rollback point.
- **It runs as goal U13, before U9.**

## Consequences
- **Remora becomes a two-license repo.**
  - The `openbot/` folder may be used only for noncommercial purposes.
  - Remora's money stays on testnet (Uy: "remora không chạy mainnet"). Before U10's mainnet money pass,
    any commercial use or any sale, either the folder is replaced or Synthetify Labs grants a license
    (licenses@openbot.run).
- **Risk with the event rules, accepted by Uy on Oct 27.** We can't grant the Sponsors rights to
  openbot's code, and judges may recognise the UI.
  - If the organizers or Synthetify Labs object, revert to `pre-u13-ui` or get the license.
  - Uy may ask on Discord before submitting.
- Huấn's kit isn't replaced: the primitives keep their Radix behaviour and `data-slot`s and take the new
  look. His design ADRs are superseded only on the visuals.
- U9 starts after U13.
- The visual tests that assert Tailwind classes are rewritten to assert behaviour or the new classes.

## Links
- [Goal U13](../goals/uy-13-openbot-ui.md)
- [Claim note](../handoffs/2026-10-27-uy-to-huan-u13-claim.md)
- Upstream: https://github.com/nightly-labs/openbot (commit `aa3c498`), `LICENSE`, `NOTICE`
