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

## Scenes (179.6 s; re-cut Nov 4 around live proof, [ADR-0106](../../adr/0106-wow-pass-more-uses.md); the network added Nov 5, [ADR-0118](../../adr/0118-video-network-scenes.md))
| Scene | What it shows |
|---|---|
| Hook | "Always-on agents you actually own.", what Remora is in four pills |
| Without vs with | An agent with your key pays an injected address (an illustration). A remora's payment to it aborts onchain (testnet tx `7NYf3QGE…`) |
| 01 · Try it, no wallet | Home's "What's a remora?", then `/playground`: a 1 USDC limit onchain, eight question cards with Reef prices, a paid answer as a receipt card, and the payment's receipt, verified |
| 02 · Your own remora | `/remoras/new`: 0.50 a month, ≤ 0.015 a payment, one signature, practice mode, Go live |
| 03 · One question, three services | In its thread, one question buys a Sui risk check, a wallet X-ray and prices: three receipts. Then "What does a Sui upgrade cap do?" is answered free |
| 04 · It learns from you | A Wallet watcher is taught in plain words. The capture then sends a real 0.001 SUI to the address it watches, and the new rule ignores it |
| 05 · A brief every morning | A Briefer's list (prices, weather, a repo), Run now, and one brief with a receipt for each purchase |
| 06 · An attack, live | `DEMO_ATTACK=1` ([ADR-0110](../../adr/0110-live-attack-bait-and-switch.md)): "Market data" demands payment to the attacker's address. The safety check blocks it before signing, and Why? shows the address it refused |
| The attack, in layers | The safety check, the gas station, the spending limit onchain; 28 attacks in CI with 0 overspends; the onchain abort `7NYf3QGE…` |
| 07 · Claude Code pays too | A terminal frame with the real `claude -p` command and output, recorded in the capture (the token is in a temp `remora.json`, deleted after). Then the payment in the remora's thread |
| 08 · Memory you can read | `/memory`: every blob on Walrus, matched writes shown, search |
| 09 · You stay in control | `/funds`: your USDC stays in your address; Pause all |
| 10 · Remoras pay remoras | A second owner's Researcher sees `@uy-researcher` on sale and lets it pay with one signature. "ask @uy-researcher is package 0x2 safe to depend on?" pays 0.01 USDC, and the chip shows the chain: → it paid Sui risk check 0.01 ([ADR-0118](../../adr/0118-video-network-scenes.md)) |
| 11 · A crew of remoras | The Research crew (one signature). The lead's answer lists three members' receipts, and the Crew card shows each member's spend |
| Why Remora | Bounded, Accountable, Learns, Yours |
| Lockup | "Give an agent a budget, not your wallet."; the playground |

**Cut for time in this version:** "Where the money goes" and "06 · Over the cap, it asks". Both stay
in the app and the README.

**Capture with the attacker:** `DEMO=1 DEMO_ATTACK=1 bun run --filter @remora/e2e e2e -- --project=demo`.
`claude` must be signed in; without it, the scene says "an MCP client".

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
