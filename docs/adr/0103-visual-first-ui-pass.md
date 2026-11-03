# ADR-0103: A visual-first pass over the whole web: fewer words, data shown as pictures, three review rounds, then the video

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Uy Le (asked for a UI/UX goal: "make the web use fewer words, or visuals, or show data
  so it's easy to understand, not too much"; review and fix it yourself about three times across every
  page, section and layout; when nothing is left to fix, make the video again; animation and SVG are
  welcome), Uy's agent

## Context
- **The app explains itself in sentences.**
  - [ADR-0094](0094-plain-words-in-the-product.md) and [ADR-0101](0101-researcher-and-wallet-watcher.md)
    made the words plain.
  - [ADR-0095](0095-explain-the-app-in-the-app.md) added "What's a remora?", page purposes and a guide
    that leads with steps.
  - The result reads clearly, but many pages are paragraphs. Numbers that matter (spent against a
    limit, days a memory has left, whether a receipt checks out) are often sentences.
- **A judge gives the app a few minutes.** The landing page ([ADR-0102](0102-landing-v2-live-shader.md))
  now looks like a launch, and the app behind it should read at a glance too.
- **The demo video films the app** ([ADR-0091](0091-real-app-demo-video.md)), so it changes when the
  app does. Submission is due Nov 10 at 17:00 UTC, and the target is Nov 9.

## Decision
- **Goal U14** ([spec](../goals/uy-14-visual-ui-pass.md)) does one pass over every route of
  `apps/web`, every section of `apps/landing`, and the video. Uy's agent claims the look of `apps/web`
  ([ADR-0027](0027-flex-takeover.md), [claim note](../handoffs/2026-11-04-uy-to-huan-u14-claim.md)).
- **Fewer words.**
  - A page says what it's for in one line, and has one main action.
  - No block of prose runs longer than two lines on an app page. The guide and chat content are
    exempt.
  - An explanation a newcomer needs moves into a `?` hint or the guide, never just deleted. Every
    hint links to the guide.
  - The plain words of ADR-0094 and ADR-0101 stay the vocabulary.
- **Data as pictures.**
  - A number that matters is the biggest thing in its card, with its unit and what it's measured
    against: a meter for spent against a limit, a bar for the days a memory has left, a check list for
    a receipt.
  - Logs become timelines with an icon per kind of event.
  - Flows (where the money goes, a payment's steps, the safety layers) are SVG diagrams. They move only
    to show what changes.
  - Every number on an app page comes from the API. No illustration numbers in the app.
- **One small visual kit, our own code.**
  - It lives in `apps/web/src/components/visual/`, MIT, outside the PolyForm folder
    ([ADR-0069](0069-openbot-ui-ported-under-polyform.md)).
  - It's built on what the web already has: `motion`, `lucide-react`, `recharts` and inline SVG. No new
    dependency comes in without its own ADR.
  - Every visual-only fact has a text alternative for screen readers.
  - Reduced motion shows each animation's end state.
  - WebGL stays on the landing page only.
- **Measured.**
  - An opt-in capture (extending the audit run) screenshots every route and state on desktop and
    phone.
  - It counts the interface words in the main pane. User and agent content, numbers, addresses and
    digests don't count.
  - Each round records the count next to round 0's.
- **Reviewed three times, by a fresh reviewer each round.**
  - The reviewer sees only the screenshots, the rubric in the goal, and from round 2 on, the previous
    round's findings.
  - It never sees the code or the fixer's notes, so it isn't anchored on them.
  - Each round has a focus: round 1 structure and words, round 2 data and flows, round 3 polish and
    consistency.
  - The findings, the decisions on them and the word table go in `docs/ux/review/`.
- **Then the video.**
  - The app freezes when round 3 has no blocker or major finding left. The freeze is Nov 7, 12:00
    Vietnam time at the latest, whatever is left.
  - The demo is re-captured and its captions go through the same rubric.
  - The landing page's screens are re-shot from the frozen app.
- **Lanes and safety.**
  - The work runs on the branch `u14-visual-ui` from the tag `pre-u14-ui`, and merges through a PR.
  - No API, `packages/schema`, `lib/api.ts` or data-hook changes. A visual that needs data the API
    doesn't return goes on a list for later.
  - The e2e specs keep what they assert. When a visible text they select by goes away, the spec moves
    to a role name or a test id in the same commit, with the reason.
  - The deploy waits for Uy's yes.

## Consequences
- **The app reads at a glance,** and the video shows the same thing.
- **ADR-0095's explanations stay reachable,** but they may move into hints and diagrams. The exit ADR
  records what changed, and supersedes the parts of ADR-0095 it replaces.
- **Many e2e selectors change.** Huấn reviews them in the PR.
- **The time box wins over polish.** Anything left at the freeze is listed for after the submission.
- **The video is rendered again,** about 4–5 hours on this machine. The upload is still Uy's step.

## Links
- [Goal U14](../goals/uy-14-visual-ui-pass.md) · [ADR-0027](0027-flex-takeover.md) ·
  [ADR-0069](0069-openbot-ui-ported-under-polyform.md) · [ADR-0091](0091-real-app-demo-video.md) ·
  [ADR-0094](0094-plain-words-in-the-product.md) · [ADR-0095](0095-explain-the-app-in-the-app.md) ·
  [ADR-0098](0098-remora-faces-with-moods.md) · [ADR-0101](0101-researcher-and-wallet-watcher.md) ·
  [ADR-0102](0102-landing-v2-live-shader.md)
