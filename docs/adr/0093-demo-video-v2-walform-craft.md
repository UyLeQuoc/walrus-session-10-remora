# ADR-0093: Demo video v2, told and rendered the way WalForm's videos are

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (pointed at `WalForm/docs/media`: "learn how WalForm does it"; built by Uy's agent)

## Context
- **v1 of the real-app demo ([ADR-0091](0091-real-app-demo-video.md)) works, but it reads like slides.**
  - The footage sat at 0.878 scale beside a left column of problem/fix copy and a checklist.
  - The callouts competed with that column.
  - It rendered at 30 fps with no motion blur.
- **WalForm, Uy's earlier project, has a set of launch videos** (walrus-memory, referral links, new
  features, a showreel) built from code. The craft they share:
  - **The story:** a hook, then *without vs with*, then chapters, a diagram of what moves, a "why"
    row and a lockup.
  - **On the footage:** a step tracker on top whose dots turn into checks; one caption at a time at
    the bottom; a spotlight that dims everything but the element in question; HUD corner brackets.
  - **In the render:** 60 fps, each frame the mean of 4 sub-frames (a 180° shutter); a finalize pass
    with light grain and a one-frame RGB split; a master plus a 30 fps share copy; thumbnails; a
    contact sheet to review the edit.
- **WalForm's media lives only on Uy's machine** (not in its git), so we port the techniques, not files.

## Decision
- **Rewrite `docs/launch/demo/demo.html` as v2,** still in Remora's own design system (openbot
  tokens, Inter, a light canvas), with WalForm's structure. Scenes (~162 s):
  1. **Hook.** The logo, the hackathon badge, "Always-on agents / you actually own." revealed
     character by character, four pills.
  2. **Without vs with.** An agent with your key pays an injected address, "WALLET DRAINED" (labelled
     *Illustration*). A remora's `disc::pay` to the same address, "ABORTED ONCHAIN", with the real
     testnet tx `7NYf3QGE…`.
  3. **Footage chapters:**
     - 01 Try it, no wallet;
     - 02 Your own remora;
     - 03 Ask, pay, see why;
     - 04 It learns from you;
     - 05 Memory you can read;
     - 06 Over the cap, it asks;
     - 07 You stay in control.
  4. **Where the money goes.** Your address → the Disc → the x402 facilitator → a Reef service. Each
     node lights up as the payment passes.
  5. **The attack.** Three layers; a packet travels behind the cards; the real tx; 28 attacks with 0
     overspends.
  6. **Why Remora.** Bounded, Accountable, Learns, Yours.
  7. **Lockup.** "Give an agent a budget, not your wallet." and the playground CTA.
- **On the footage:**
  - **Window.** It plays at 0.88 scale, centred, so the caption track sits below it and covers
    nothing.
  - **Steps and captions.** The step tracker and the captions are keyed to the capture's own marks,
    so a re-capture keeps them in sync. A step may add an offset for a shot with fewer marks than
    steps.
  - **Spotlights.** They take app CSS pixels, measured on the capture's frames, and lean the camera
    in a little.
  - **The rule from ADR-0091 still holds: a caption says only what the screen shows.**
- **Sound.**
  - A softer bed with a generated reverb.
  - A key tick for every character typed in the footage, mapped through the cut.
  - A click tick for every real click.
  - A two-note chime when a step completes.
  - Low hits on the stamp and on each blocked layer.
- **`render.ts` follows WalForm's pipeline:**
  - **The frames.** 1080p60. Each frame averages 4 sub-frames across half a frame's time. ffmpeg
    does the averaging (`tmix` over each group, then `select`), so no image library is needed.
  - **The master,** `remora-demo.mp4`: grain `noise=c0s=4:c0f=t+u`, and a few frames of `rgbashift` where
    the stamp lands and where each layer blocks. H.264 CRF 16, AAC 320k.
  - **The share copy,** `remora-demo-web.mp4`: 30 fps, `-tune animation`, CRF 24, AAC 128k. The
    landing page plays this one.
  - **Sound and stills.** The soundtrack is `soundtrack.wav` at −14 LUFS and 48 kHz. Two thumbnails
    come from the hook: `thumbnail.jpg` (1080p) and `thumbnail-youtube.jpg` (720p).
  - **New flags:**
    - `--sheet N` writes a contact sheet of N moments;
    - `--sub 1 --fps 30` makes a quick draft.
- **The landing page's poster** is the video's thumbnail now, not a frame at a fixed second that moves
  with every re-cut.
- **v1 stays in git history** (`4659a9e`). It isn't kept beside v2.

## Consequences
- **The form's video is ~162 s,** inside the 2–3 minutes the form asks for.
- **It shows the real app throughout:**
  - the illustrations are labelled;
  - every onchain claim has a real testnet transaction;
  - every number comes from the capture or from ADR-measured runs.
- **A full render takes a few minutes on 8 workers.** The master is larger; the share copy is the one
  to upload where size matters.
- **[ADR-0091](0091-real-app-demo-video.md)'s capture is unchanged.** Its edit (the left column and
  the callouts) is replaced by this one.
- **Docs:** `docs/launch/demo/README.md`, the submission draft's video line and the landing build.

## Links
[ADR-0090](0090-motion-graphics-showreel.md) · [ADR-0091](0091-real-app-demo-video.md) ·
[ADR-0092](0092-landing-page.md) · [docs/launch/demo/README.md](../launch/demo/README.md)
