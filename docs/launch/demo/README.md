# The demo video (the real app, problem → fix)

This video shows the real app, recorded on Sui testnet ([ADR-0091](../../adr/0091-real-app-demo-video.md)).
It is told and rendered the way WalForm's launch videos are
([ADR-0093](../../adr/0093-demo-video-v2-walform-craft.md)):
- a hook, then *without vs with*;
- chapters of real footage with a step tracker, one caption at a time and a spotlight;
- a diagram of where the money goes, the attack, why Remora, and a lockup.

Everything is drawn in the app's own design system.

```bash
# 1. Capture: the real stack on testnet, signing with the burner (a few cents of testnet USDC)
DEMO=1 bun run --filter @remora/e2e e2e -- --project=demo
DEMO=1 DEMO_SHOTS=create,scout bun run --filter @remora/e2e e2e -- --project=demo   # only some shots

# 2. Review: stills, a contact sheet, or watch it live
bun docs/launch/demo/render.ts --stills 30,60,90
bun docs/launch/demo/render.ts --sheet 30                                           # → out/contact-sheet.jpg
open docs/launch/demo/demo.html

# 3. Render (a few minutes on 8 workers)
bun docs/launch/demo/render.ts --workers 8
bun docs/launch/demo/render.ts --from 40 --to 70 --sub 1 --fps 30                   # a quick draft of a section
```

**What the render writes to `out/`:**

| File | What it is |
|---|---|
| `remora-demo.mp4` | The master. 1080p60, motion blur (4 sub-frames, 180° shutter), light grain, H.264 CRF 16, AAC 320k at −14 LUFS |
| `remora-demo-web.mp4` | The share copy (X, the blog, the landing page, the form). 30 fps, `-tune animation`, CRF 24, AAC 128k |
| `soundtrack.wav` | The synthesised soundtrack, 48 kHz |
| `thumbnail.jpg`, `thumbnail-youtube.jpg` | The hook frame at 1920×1080 and 1280×720 |

**Needs:**
- the root `.env` that the e2e suite needs (`E2E_BURNER_KEY`, `TATUM_API_KEY_TESTNET`, …);
- Docker Postgres;
- ffmpeg with libx264.

`capture/` and `out/` are gitignored.

## Scenes (~162 s)
| Scene | What it shows |
|---|---|
| Hook | "Always-on agents you actually own.", what Remora is in four pills |
| Without vs with | An agent with your key pays an injected address (an illustration). A remora's `disc::pay` to it aborts onchain (testnet tx `7NYf3QGE…`) |
| 01 · Try it, no wallet | `/playground`: a $1 Disc onchain → a paid answer over x402 → a receipt that verifies |
| Where the money goes | Your address → the Disc → the x402 facilitator → a Reef service; the remora's key holds 0 SUI |
| 02 · Your own remora | `/remoras/new`: 0.50 a month, ≤ 0.015 a payment, one signature, shadow mode, Go live |
| 03 · Ask, pay, see why | A paid answer from its own Disc, the cost card, Why? → the Wake |
| 04 · It learns from you | Teach a Sentinel in plain words; a small transfer ignored; the Learning tab |
| 05 · Memory you can read | `/memory`: every blob on Walrus, matched writes shown, search |
| The attack | Sonar, the gas station, the Disc onchain; 28 attacks in CI with 0 overspends |
| 06 · Over the cap, it asks | `/approvals`: pay once from your own wallet |
| 07 · You stay in control | `/funds`: your USDC stays in your address; Pause all |
| Why Remora | Bounded, Accountable, Learns, Yours |
| Lockup | "Give an agent a budget, not your wallet."; the playground |

## Editing
- **Timing.** The storyboard is `SCENES` in `demo.html`.
  - Each chapter's clip is cut by the capture's marks, e.g.
    `clip("playground", [{ from: "Ask Scout", to: "answered", dur: 3.6, badge: … }])`.
  - Its steps, captions and spotlights are keyed to marks too, so a re-capture keeps the cut.
  - A missing mark logs a warning when you render.
- **Captions.**
  - `caps: [[mark, offset, seconds, html]]`.
  - One shows at a time, and `<b>` is highlighted.
  - A caption must say only what the screen shows.
- **Spotlights.**
  - They take the app's CSS pixel coordinates (1440×900).
  - Measure them on a frame in `capture/<shot>/`.
