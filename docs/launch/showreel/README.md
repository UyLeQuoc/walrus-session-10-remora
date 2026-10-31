# The showreel (180 s, motion graphics)

A 3-minute motion-graphics piece about Remora, drawn from code and rendered to MP4
([ADR-0090](../../adr/0090-motion-graphics-showreel.md)).

```bash
open docs/launch/showreel/showreel.html                  # plays live; click once for sound
bun docs/launch/showreel/render.ts                       # → out/remora-showreel.mp4 (1080p30, H.264 + AAC) and -web.mp4 (~40 MB)
bun docs/launch/showreel/render.ts --stills 6,40,95      # PNG stills, to check a layout
bun docs/launch/showreel/render.ts --from 40 --to 70     # one section
bun docs/launch/showreel/render.ts --audio               # → out/soundtrack.wav
```

**Needs:**
- ffmpeg with libx264;
- the e2e workspace installed (`bun install`), whose Playwright Chromium does the capture.

A full render takes about 10 minutes. `out/` is gitignored.

## Scenes
| Time | Scene | On screen |
|---|---|---|
| 0:00 | Open | Particles gather into the block R; "remora"; "Always-on agents you actually own." |
| 0:09 | The half-green row | Whole wallet or every click, both struck. The audit's "Spending limits" row fills: Remora |
| 0:21 | Three promises | The Disc (budget ring, caps, payees); memory on Walrus (real blob ids); the Wake receipt, stamped |
| 0:40 | 01 · An unknown token lands | Sentinel → Scout → Reef `402` → `disc::pay` → facilitator → Tatum → Sui → the answer, verified |
| 1:10 | 02 · It learns from you | 👎 → "ignore incoming SUI under 0.002" → Walrus in 25.3 s (`rbQ84ahd…`) → the next 0.001 SUI is quiet |
| 1:35 | 03 · A paid answer tries to steal | The injection; Sonar, the gas station and the Disc (`EPayeeNotAllowed`, `7NYf3QGE…`); 28 attacks, 0 overspends |
| 1:57 | 04 · A key pays without a decision | The checkpoint stream, a `Paid` with no Wake, 3:00, the alert's real copy, rotate |
| 2:12 | 05 · Memory that knows what holds | The facts ledger, owner vs agent, 1.2×, Claude Code over MCP |
| 2:32 | 06 · The product | The Oct 31 audit screenshots in a 3D carousel |
| 2:47 | 07 · Numbers | 360 memories on mainnet, 12 Tatum gRPC calls, 0 overspends, 0.01 USDC, 25.3 s, 48 e2e tests |
| 2:56 | Close | Logo, tagline, "Try Scout · $1 Disc · no wallet" |

## Editing
- **Timing.** The cues are in `S` and `CUES` at the top of the script. The music reads the same cues.
- **Copy and numbers.** Edit them in the scene HTML. Every number must come from a recorded run.
- **Checking a change.** Render stills with `--stills` and look at them before the full render.
