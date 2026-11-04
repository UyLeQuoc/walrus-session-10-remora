# The demo video (the real app, problem → fix)

This video shows the real app, recorded on Sui testnet ([ADR-0091](../../adr/0091-real-app-demo-video.md)),
in its dark theme with the product's plain words ([ADR-0096](../../adr/0096-demo-video-dark-plain-words.md)).
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
DEMO=1 DEMO_THEME=light bun run --filter @remora/e2e e2e -- --project=demo           # the light theme

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

**Before it films the new Researcher,** the capture retires the `Researcher · demo` and
`Researcher · examples` remoras earlier runs left, so the sidebar isn't a column of old ones. A partial
re-capture (`DEMO_SHOTS`) without `create` keeps them.

## Scenes (178 s, re-captured Nov 4 from the visual-first app, [ADR-0103](../../adr/0103-visual-first-ui-pass.md), with "08 · And more", [ADR-0105](../../adr/0105-examples-you-can-try.md))
| Scene | What it shows |
|---|---|
| Hook | "Always-on agents you actually own.", what Remora is in four pills |
| Without vs with | An agent with your key pays an injected address (an illustration). A remora's payment to it aborts onchain (testnet tx `7NYf3QGE…`) |
| 01 · Try it, no wallet | Home's "What's a remora?" (a money Flow), then `/playground`: a 1 USDC limit onchain → a paid answer as a receipt card → the payment's receipt, verified |
| Where the money goes | Your address → its spending limit → the x402 facilitator → a paid service; the remora's key holds 0 SUI |
| 02 · Your own remora | `/remoras/new`: 0.50 a month, ≤ 0.015 a payment, one signature, practice mode, Go live |
| 03 · Ask, pay, see why | A paid answer from its own Disc, the cost card, Why? → the Wake |
| 04 · It learns from you | Teach a Wallet watcher in plain words. The capture then sends a real 0.001 SUI to the address it watches, and the new rule ignores it |
| 05 · Memory you can read | `/memory`: every blob on Walrus, matched writes shown, search |
| The attack | The safety check, the gas station, the spending limit onchain; 28 attacks in CI with 0 overspends |
| 06 · Over the cap, it asks | `/approvals`: pay once from your own wallet |
| 07 · You stay in control | `/funds`: your USDC stays in your address; Pause all |
| 08 · And more | Real footage of four more parts of the app:<ul><li>the template gallery (six templates on Walrus);</li><li>a template's consent ("Passed the safety review", one signature to use it);</li><li>a room where remoras answer together;</li><li>a connection Claude Code uses within its limits;</li><li>Telegram in Settings.</li></ul> |
| Why Remora | Bounded, Accountable, Learns, Yours |
| Lockup | "Give an agent a budget, not your wallet."; the playground |

## Editing
- **Timing.** The storyboard is `SCENES` in `demo.html`.
  - Each chapter's clip is cut by the capture's marks, e.g.
    `clip("playground", [{ from: "Ask Scout", to: "answered", dur: 3.6, badge: … }])`.
  - Its steps, captions and spotlights are keyed to marks too, so a re-capture keeps the cut.
  - A missing mark logs a warning when you render.
- **A chapter over several pages** gives each segment its own `url` for the address bar, and ends each
  part on a mark placed after its hold, so the cut skips the page loads.
- **Captions.**
  - `caps: [[mark, offset, seconds, html]]`.
  - One shows at a time, and `<b>` is highlighted.
  - A caption must say only what the screen shows.
  - Ten words or fewer (ADR-0103), and a chapter whose app has its own stepper has no `steps`.
- **Spotlights.**
  - `spots: [{ at, off, len, box: "label" }]` lights the element the capture recorded under that label.
  - `demo.spec.ts` records a box with `s.box(label, locator)`, and with every labelled `s.to` /
    `s.click`, so a re-capture after a UI change needs no re-measuring.
  - `r: { x, y, w, h }` in app CSS pixels (1440×900) still works for a fixed rect.
