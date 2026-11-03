# Landed: remora faces with moods

- **Date:** 2026-11-02
- **From:** Uy's agent ([ADR-0098](../adr/0098-remora-faces-with-moods.md))
- **To:** Huấn
- **Status:** on `main` since Nov 3. Uy asked for avatars in the style of
  [Dots Lab](https://dots-lab.pages.dev): "we don't really use avatars yet, use them". These web
  edits are follow-ups under ADR-0087.

## What changed in your lane
- **`components/app/remora-avatar.tsx`:**
  - `RemoraAvatar` draws an SVG face instead of the initial.
  - The shape and tint come from the id.
  - `mood` is one of `idle`, `listening`, `thinking`, `success`, `alert`, `error`, `asleep` or `off`.
  - `still` stops the motion.
  - The `name` prop is gone.
  - `remoraMood(remora, waiting)` maps the status, the template and waiting approvals to a mood.
- **`components/app/remora-face.css`** (imported in `index.css`) holds the face tints, the eye
  colours for light and dark, and the motion. Nothing moves under reduced motion.
- **Where moods come from:**

  | Place | Mood |
  |---|---|
  | Roster | the status, plus `alert` when it has approvals waiting (`SidebarTeam` takes `waiting`) |
  | "Needs you" | `alert`; it now uses `remoraId`, so the face matches the roster |
  | Remora cards and the remora page title (new, 40 px) | the status |
  | Chat header | `threadMood`: thinking while it answers, then a payment, block or approval from the last minute |
  | Room messages, clusters, ⌘K | `still` |

- **"What's a remora?"** shows Scout's and Sentinel's faces instead of the icons, and a row with
  what the faces mean.
- **A new test, `components/app/remora-avatar.test.tsx`,** covers the stable faces, the moods and
  `threadMood`.

## To check
- **The e2e selectors are unchanged.** The face is `aria-hidden`, adds no text, and keeps
  `data-slot="remora-avatar"`.
- **The demo video was re-captured on Nov 3** and shows the faces.
- **The "Needs you" row has two badges:** openbot's inbox badge and the face's "!". Tell me if one
  should go.
