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

## Narration (Nov 10, [ADR-0155](../../adr/0155-narrated-video-and-x-article.md))
- Sixteen lines, one per scene, in [narration/script.json](narration/script.json), each starting at its scene's `at` second and fitting inside it.
- `python3 -I docs/launch/demo/narration/tts.py docs/launch/demo/narration/script.json docs/launch/demo/out/narration` makes the clips with ElevenLabs (voice Eric, `eleven_multilingual_v2`; needs `ELEVENLABS_API_KEY` in `.env`).
- `python3 -I docs/launch/demo/narration/mix.py <silent master>` ducks the soundtrack under the voice, normalizes to −14 LUFS and muxes the mix onto `out/remora-demo.mp4` and `out/remora-demo-web.mp4` without re-encoding the video. The silent Nov 6 files are in `out/backup-nov6-175s-novoice/`.
- On YouTube: <https://youtu.be/_ioDZcXperI> (narrated, public). The silent cut, `6CgJ6HKZjDs`, is unlisted. The description credits "Voice: ElevenLabs" (free plan).

## Scenes (175.0 s; re-cut Nov 4 around live proof, [ADR-0106](../../adr/0106-wow-pass-more-uses.md); the network added Nov 5, [ADR-0118](../../adr/0118-video-network-scenes.md); the replay added Nov 6, [ADR-0152](../../adr/0152-video-leads-with-the-replay.md))
| Scene | What it shows |
|---|---|
| Hook | "Always-on agents you actually own.", what Remora is in four pills |
| Without vs with | An agent with your key pays an injected address (an illustration). A remora's payment to it aborts onchain (testnet tx `7NYf3QGE…`) |
| 01 · Try it, no wallet | Home's "What's a remora?", then `/playground`: a 1 USDC limit onchain, eight question cards with Reef prices, a paid answer as a receipt card, and the payment's receipt, verified |
| 02 · Your own remora | `/remoras/new`: 0.50 a month, ≤ 0.015 a payment, one signature, practice mode, Go live |
| 03 · One question, three services | In its thread, one question buys a Sui risk check, a wallet X-ray and prices: three receipts. Then "What does a Sui upgrade cap do?" is answered free |
| 04 · It gets better | The U19 run's Researcher ([ADR-0136](../../adr/0136-replay-bench.md)): its rule from your ratings ("✓ you said yes · Skip odds unless the question names a team"), then its replay of the same ten questions: no memory 10 services, memory at T₀ 10, today's memory 4, "nothing was bought". The first difference and the five memory blobs it cites ([ADR-0152](../../adr/0152-video-leads-with-the-replay.md)) |
| 05 · A brief every morning | A Briefer's list (prices, weather, a repo), Run now, and one brief with a receipt for each purchase |
| 06 · An attack, live | `DEMO_ATTACK=1` ([ADR-0110](../../adr/0110-live-attack-bait-and-switch.md)): "Market data" demands payment to the attacker's address. The safety check blocks it before signing, and Why? shows the address it refused |
| The attack, in layers | The safety check, the gas station, the spending limit onchain; 28 attacks in CI with 0 overspends; the onchain abort `7NYf3QGE…` |
| 07 · Claude Code pays too | A terminal frame with the real `claude -p` command and output, recorded in the capture (the token is in a temp `remora.json`, deleted after). Then the payment in the remora's thread |
| 08 · Memory you can read | `/memory`: every blob on Walrus, matched writes shown, search |
| 09 · Remoras pay remoras | A second owner's Researcher sees `@uy-researcher` on sale and lets it pay with one signature. "ask @uy-researcher is package 0x2 safe to depend on?" pays 0.01 USDC, and the chip shows the chain: → it paid Sui risk check 0.01 ([ADR-0118](../../adr/0118-video-network-scenes.md)) |
| 10 · A crew of remoras | The Research crew (one signature). The lead's answer lists three members' receipts, and the Crew card shows each member's spend |
| Why Remora | Bounded, Accountable, Learns, Yours |
| Lockup | "Give an agent a budget, not your wallet."; the playground |

**Cut for time in this version:** "Where the money goes", "06 · Over the cap, it asks", "04 · It
learns from you" (the Wallet watcher taught in plain words) and "09 · You stay in control" (`/funds`,
Pause all). All stay in the app and the README.

**The replay shot** films a Researcher the `U19=1` run made in the local database (one named
"Researcher · u19" with a finished replay that planned fewer services today than with no memory). To
re-film only it, without spending: `DEMO=1 E2E_KEEP_DISCS=1 DEMO_SHOTS=replay bun run --filter
@remora/e2e e2e -- --project=demo tests/demo.spec.ts`.

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
