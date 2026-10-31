# ADR-0090: A 180 s motion-graphics showreel, rendered from code

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (asked for "a dynamic 180-second motion graphics video… showcase the project"; built by Uy's agent)

## Context
- **The form asks for a 2–3 minute demo video.** The plan was a screen capture of the deployed app
  ([ADR-0081](0081-launch-story.md), the demo script in [remora-plan.md](../remora-plan.md)). That
  needs the U9 deploy and days of dogfooding, and neither has happened.
- **Uy asked for a showreel.** It should be a motion-graphics piece that shows the whole project, with
  no deploy needed.
- **The tools are already here:**
  - ffmpeg with libx264 and AAC;
  - the e2e workspace's Playwright Chromium;
  - Inter;
  - the audit screenshots of real screens.

## Decision
- **`docs/launch/showreel/showreel.html` draws every frame as a pure function of time.**
  - `render(t)` sets the whole 1920×1080 stage for second `t`: a canvas background, DOM scenes and a
    HUD.
  - Opened in a browser, it plays live. `?t=42.5` shows one still.
- **`render.ts` renders the MP4.**
  - Playwright captures 5,400 frames (180 s at 30 fps) across parallel pages.
  - The soundtrack is synthesised with WebAudio's `OfflineAudioContext` from the same cue list, so the
    impacts land on the cuts and the blips on the events. It has pads, bass, kick, hats, an arp,
    risers and impacts, at 100 BPM in D minor. No third-party music is used.
  - ffmpeg encodes H.264 (CRF 17) and AAC, with loudness normalised to −14 LUFS.
  - Output goes to `out/`, which is gitignored.
- **The story follows ADR-0081:**
  1. the half-green row;
  2. the three promises;
  3. moment 1: x402 on Sui, through the facilitator and Tatum;
  4. moment 2: a 👎 becomes a rule on Walrus in 25.3 s, and the next event is quiet;
  5. moment 3: the injection, with three layers, the onchain abort `7NYf3QGE…`, and 28 attacks with
     0 overspends;
  6. moment 4: the reality check;
  7. memory that knows what holds (after Dewee);
  8. real screens;
  9. numbers;
  10. the close.
- **Truthfulness.**
  - Ids, digests, prices, timings and copy on screen come from recorded runs, tests or the app's own
    text.
  - The wallet's unknown coin and the stream's cells are illustrations, and they don't pose as data.
  - It says "testnet" wherever money moves.

## Consequences
- **There is a 3-minute video today,** reproducible with one command, with no deploy, no recording
  session and no licensed assets.
- **It shows the system; it isn't a demo of the deployed app.** For the form's "working demo", the
  plan still stands:
  - a short screen capture on the deployed URL, which the showreel can open or close;
  - or the showreel alone, if time runs out.

  It also serves the X post and the blog.
- **Changing a number on screen means editing `showreel.html` and re-rendering** (about 10 minutes).

## Links
- [ADR-0081](0081-launch-story.md) · [ADR-0084](0084-enter-best-use-of-agent-payments.md) ·
  [docs/launch/showreel/README.md](../launch/showreel/README.md)
