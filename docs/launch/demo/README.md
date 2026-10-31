# The demo video (the real app, problem → fix)

This video shows the real app, recorded on Sui testnet. It plays inside a window and is told as
problem → fix, with SVG callouts drawn in the app's own design system
([ADR-0091](../../adr/0091-real-app-demo-video.md)).

```bash
# 1. Capture: the real stack on testnet, signing with the burner (a few cents of testnet USDC)
DEMO=1 bun run --filter @remora/e2e e2e -- --project=demo
DEMO=1 DEMO_SHOTS=create,scout bun run --filter @remora/e2e e2e -- --project=demo   # only some shots

# 2. Render: → out/remora-demo.mp4 (1080p30) and out/remora-demo-web.mp4 (~40 MB)
bun docs/launch/demo/render.ts
bun docs/launch/demo/render.ts --stills 30,60,90                                     # check a layout
open docs/launch/demo/demo.html                                                      # watch it live
```

**Needs:**
- the root `.env` that the e2e suite needs (`E2E_BURNER_KEY`, `TATUM_API_KEY_TESTNET`, …);
- Docker Postgres;
- ffmpeg with libx264.

`capture/` and `out/` are gitignored.

## Scenes
| Scene | The problem | The fix, as the real app shows it |
|---|---|---|
| Title | | Always-on agents you actually own |
| The problem | All or nothing · one sentence away · a black box | Each card turns to the Remora answer |
| Try it, no wallet | Letting an agent pay means your whole wallet or every click | `/playground`: a $1 Disc onchain → a paid answer over x402 → a receipt that verifies |
| Your own remora | Agent wallets are all-or-nothing | `/remoras/new`: 0.50 a month, ≤ 0.015 a payment, one signature, shadow mode, Go live |
| Why it did that | You can't see what it spent, or why | A paid answer from its own Disc, the budget meter, Why? → the Wake |
| It learns | Agents forget what you told them | Teach a Sentinel in plain words; the Learning tab |
| Memory you can read | Memory you can't read can't be trusted | `/memory`: every blob, skipped duplicates shown, search |
| Injection | One injected sentence can drain a wallet | An SVG of the three layers, the onchain abort `7NYf3QGE…`, 28 attacks with 0 overspends |
| Over the cap | | `/approvals`: it asks instead of paying |
| You stay in control | A runaway agent is hard to stop | `/funds`: Pause all, revoke, rotate |
| Open by default | | `/reef` and `/status` |
| Try it | | `/playground`, $1 Disc, no wallet |

## Editing
- **Timing.** The storyboard is `SCENES` in `demo.html`. Each clip is cut by the capture's marks
  (`clip("playground", [{ from: "Ask Scout", to: "answered", dur: 4.2, badge: … }])`), so a
  re-capture keeps the cut.
- **Callouts.** They take the app's CSS pixel coordinates (1440×900). Measure them on a frame in
  `capture/<shot>/`. They must say only what the screen shows.
