# ADR-0149: Template ratings signed by wallet, weighted by paid calls, author analytics and a badge

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
Goal U19's D2 (M10–M12 in [remora-features.md](../remora-features.md), spec in
[uy-19-it-gets-better.md](../goals/uy-19-it-gets-better.md)) lets an owner who hatched a template
rate it, gives the author a view of how it's used, and gives every template an embeddable badge.

What we had:
- The Hatchery ([ADR-0047](0047-hatchery-move-package.md)) records hatches as `Forked` events and
  `hatchery_forks` rows that list the remoras we created for each hatch.
- Payments are `payment` events per remora; U17's sales are `action` events with `kind: "sale"`
  ([ADR-0111](0111-scale-pass.md)).
- `addressFromSignature` (`@remora/memory`) checks a personal-message signature, zkLogin included
  with a fullnode client. Listing an API in the Reef already signs a message this way
  ([ADR-0113](0113-community-listings-and-public-facilitator.md)).
- No schema push in U19 ([ADR-0134](0134-u19-it-gets-better-and-anyone-can-check.md)); the web feed's
  event types are a strict enum.
- The template page had an M12 badge with text-only snippets; only `/api/*` reached the API from the
  web's origin.

## Decision
- **A rating** is 1–5 stars and at most 280 characters.
  - Signed as a personal message, no transaction. The server builds the message from the fields:
    network, template id, stars, the SHA-256 of the text as stored, and the time it was signed. It
    never takes the message from the client.
  - Two steps: `POST /api/hatchery/:id/rating/message` scrubs the text and returns it with the message;
    the wallet signs; `POST /api/hatchery/:id/rating` rebuilds the message and recovers the signer.
    The signature is the proof, so no session is needed. It's refused after 10 minutes.
  - Only an owner with a remora hatched from that template here may rate it.
  - Stored as a `template.rated` event on the rater's hatched remora, with the message and the
    signature, so anyone can check it again. `/api/feed` leaves it out.
  - **One per address per template:** the one signed last counts; an older signature sent again
    doesn't win, and the same signature twice is one row.
  - **Weighted by real use:** a rating weighs 1 + log2(1 + paid calls of the rater's remoras hatched
    from it), at most 6. The template's rating is the weighted average, one decimal, with the number
    of raters. A free template's ratings all weigh 1.
  - **The text** loses credentials (`redactCredentials`), emails, handles and phone numbers, and is
    rendered as plain text only.
- **Author analytics** (`GET /api/hatchery/:id/analytics`, its author only): hatches (onchain),
  remoras hatched here, active ones over 7 days, answers sold and their revenue, and every rating with
  its paid calls and weight. Public pages (gallery, template page) show the weighted rating and the
  counts only.
- **The badge:** `GET /badge/:id.svg`, also at `/api/badge/:id.svg`. The id is a template id or its
  publish digest.
  - Plain SVG: "remora" and "<name> · N hatches" with the live count. Text is XML-escaped and control
    characters are dropped; no scripts, no links.
  - Cached: `public, max-age=300` and a one-minute memo on the server. `nosniff`, and a CSP that
    allows nothing.
  - The web's `vercel.json` and the Vite dev server forward `/badge/*` to the API, like `/api/*`.
  - The template page offers a Markdown and an HTML snippet that show the SVG and link to the
    template; the name is escaped for each.

## Consequences
- **Easier:**
  - a judge sees which templates people paid to use;
  - a README can show a live count;
  - every rating can be checked without trusting us.
- **Harder:**
  - only owners who hatched here can rate; a hatch made elsewhere has no remora to carry the event;
  - a rating counts per template version, not across versions;
  - the badge is one more public route to keep cheap.
- **Docs:** the README's Hatchery lines and `docs/remora-features.md` (M10–M12) at Part E.

## Links
- [ADR-0047](0047-hatchery-move-package.md), [ADR-0105](0105-examples-you-can-try.md),
  [ADR-0111](0111-scale-pass.md), [ADR-0134](0134-u19-it-gets-better-and-anyone-can-check.md),
  [ADR-0150](0150-template-updates.md)
- Code: `apps/server/src/hatchery/ratings.ts`, `apps/server/src/hatchery/extras-routes.ts`,
  `apps/web/src/features/hatchery/rating-section.tsx`, `apps/web/src/features/hatchery/hatch-badge.tsx`
