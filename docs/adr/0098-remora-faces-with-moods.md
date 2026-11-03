# ADR-0098: A remora's avatar is a face whose eyes show what it's doing, in Dots Lab's style, drawn in our code

- **Status:** Accepted
- **Date:** 2026-11-02
- **Deciders:** Uy (asked whether the avatars should follow [Dots Lab](https://dots-lab.pages.dev), then
  "we don't really use avatars yet, use them"; built by Uy's agent)

## Context
- **The avatar was a letter.** `RemoraAvatar` drew the first letter of the name on a tinted disc
  ([ADR-0069](0069-openbot-ui-ported-under-polyform.md) kept Remora's own avatars). Uy didn't count it
  as an avatar. Since most remoras are called "Scout …" or "Sentinel …", the roster was a column of
  S's.
- **Dots Lab** (by Guillaume, @guillaume_rygn) designs "an animated character for your AI agent":
  - a soft shape in one colour, with two small eyes;
  - eight states: Idle, Listening, Thinking, Writing, Success, Alert, Error and Asleep;
  - export as PNG or animated SVG.

  The page states no license or terms. It isn't openbot's blob library (bloub, by openbot's
  maintainer), which ADR-0069 left out as openbot's brand.
- **The states match what a remora does:**
  - a Sentinel watches;
  - a Scout thinks, then answers;
  - a payment goes through;
  - an approval waits for the owner;
  - the safety check blocks a payment;
  - a remora is paused or retired.

## Decision
- **`RemoraAvatar` draws a face in our own SVG code.** No Dots Lab file is used. Its style is the
  model: one shape, one colour, small eyes, small motions.
  - **Five shapes:** pebble, drop, squircle, dome and peak.
  - **Seven tints.**
  - Both come from the id, so a remora keeps its face everywhere.
  - Its tint keeps the hue of its name colour in a room (`remoraTintText`).
- **Eight moods (`data-mood`).** Dots Lab's Writing is left out, because the chat can't tell
  writing from buying data, and its line already shows typing dots.

  | Mood | Face | When |
  |---|---|---|
  | `idle` | pill eyes that blink | at rest |
  | `listening` | round eyes that look around | a Sentinel, or any remora in practice mode |
  | `thinking` | eyes up and to the side, a thought | while it answers in the chat; while it's being created |
  | `success` | happy arcs, one hop | a payment in the last minute of the chat |
  | `alert` | wide eyes, an amber "!" | approvals waiting (the roster, "Needs you"); a fresh approval card |
  | `error` | "> <", one shake | the safety check blocked a payment in the last minute |
  | `asleep` | closed eyes, z's | paused |
  | `off` | flat eyes, grey | retired |

  - `remoraMood(remora, waiting)` picks the mood from the status, the template and the approvals.
  - `threadMood` adds the chat's live state.
- **Where the faces show:**
  - the roster (with approvals), "Needs you", the room clusters;
  - the remora cards;
  - the remora page title (40 px), the chat header and the empty chat (64 px);
  - a room's messages, and ⌘K.
  - "What's a remora?" (Home and the guide) shows Scout's and Sentinel's faces, and a row says what
    the faces mean: watching, thinking, paid, needs you, blocked a payment, paused.
- **Motion stays small:**
  - each face blinks on its own beat;
  - a `still` face (a room's messages, the clusters, ⌘K) doesn't move;
  - nothing moves under `prefers-reduced-motion`.
  - The styles are in `components/app/remora-face.css`.
- **The "Needs you" face now uses the remora's id** (`remoraId` from `/api/approvals`) instead of its
  name, so it matches the roster.
- **The wallet's identicon stays.** It stands for the person, not a remora.
- **Credit:** this ADR and the component's header name Dots Lab as the style's source.

## Consequences
- **A glance at the roster says which remora needs you, which watches and which sleeps,** not only
  the status dot.
- **We copy a style, not files.** The shapes and faces are ours, so there's no license to ask for.
  - They do look closer to openbot's blob faces than the letters did. Faces with eyes are a common
    idea, and these are our drawings.
- **The demo video (ADR-0096) shows the old letters.** A new capture needs the local UI stack
  (8797–8799/5183) and a few cents of testnet USDC. It's Uy's call.
- **The e2e selectors don't change.** The face is `aria-hidden` and adds no text; `data-slot` stays.
- **Docs updated:**
  - `docs/ux/README.md` (Faces);
  - `docs/remora-features.md` (N16);
  - the handoff to Huấn.

## Links
[ADR-0069](0069-openbot-ui-ported-under-polyform.md) ·
[ADR-0094](0094-plain-words-in-the-product.md) · [ADR-0095](0095-explain-the-app-in-the-app.md) ·
[ADR-0096](0096-demo-video-dark-plain-words.md) · `apps/web/src/components/app/remora-avatar.tsx` ·
[handoff](../handoffs/2026-11-02-uy-to-huan-remora-faces.md) · https://dots-lab.pages.dev
