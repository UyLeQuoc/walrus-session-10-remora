# Examples you can try, and the video's "And more" (Nov 4, 2026)

**The decision:** [ADR-0105](../adr/0105-examples-you-can-try.md).

**Where it ran:** the branch `u15-examples`, merged through a PR. Huấn's lane is claimed in
[the claim note](../handoffs/2026-11-04-uy-to-huan-examples-claim.md).

**Why:** Uy asked for more varied, more interesting examples, and asked whether the video showed every
feature. It showed about 20 of the 69 ship-set features.

## What changed
- **Chat** (`/chat`, empty):
  - **Before:** four grey lines.
  - **Now:** cards from a pool of 12, four at a time, one of each kind:
    - Researcher pays;
    - Wallet watcher learns;
    - Memory;
    - Proof.

    "More ideas" deals the next four.
  - **Where each card goes:**
    - a Researcher or Wallet watcher card opens that remora's own thread with the text filled in;
    - a memory card fills the box;
    - a command card (`/whoami`, `/memory`, `/privacy`) runs at once.
  - **This fixes two cards that didn't work.** "Ask Researcher…" and "Teach Wallet watcher…" used to
    land in `/chat`, which can only remember and recall.
- **Playground.**
  - **Before:** two text buttons.
  - **Now:** four cards:
    - the Sui risk check;
    - the odds;
    - a Brief of a public page;
    - one question needing no purchase.

    Each card names its service and its price from the Reef.
- **Templates:**
  - **Six varied templates** are published to Walrus through the real Hatchery by the E2E burner on
    testnet. They are Package auditor, Match-day odds, Docs digest, Quiet wallet, Big moves only, and
    Token desk (a room of two).
  - **The 14 test-run templates** from `u7.spec` are deprecated onchain by their author.
  - **The gallery hides** deprecated and blocked templates behind "Show hidden (N)".
  - **`u7.spec` deprecates** the template it publishes.
- **The site's own address:** `SITE_URL` (canonical links) and the guide's "Web" channel said
  `remora.vercel.app`, which is someone else's site ("Remora Bank"). Both now say getremora.vercel.app.

## Every example, run once on testnet (`EXAMPLES=1`, all pass)
| Example | Where | What it did |
|---|---|---|
| Is package 0x2 safe to depend on? | Researcher's thread | Paid 0.01 USDC to Sui risk check |
| What are the odds for tonight's match? | Researcher's thread | Paid 0.02 USDC to Odds |
| Summarize https://docs.wal.app in three lines | Researcher's thread | Paid 0.01 USDC to Brief |
| Ignore incoming SUI under 0.01 | Wallet watcher's thread | Learned: ignore, in, SUI, under 0.01 |
| Ping me about outgoing USDC over 1 | Wallet watcher's thread | Learned: ping, out, USDC, over 1 |
| Mute airdrops and unknown tokens | Wallet watcher's thread | Learned: ignore, in, unknown coins |
| Remember that I build on Sui testnet and settle in USDC | `/chat` | Answered |
| Remember that I like short answers with sources | `/chat` | Answered |
| Reload, then ask what you remember | `/chat`, after a reload | Answered |
| Where does my memory live? | `/chat` | Ran `/whoami` |
| What do you remember about me? | `/chat` | Ran `/memory` |
| What's stored, and for how long? | `/chat` | Ran `/privacy` |
| Playground: Is package 0x2 safe to depend on? | `/playground` | Paid 0.01 USDC to Sui risk check |
| Playground: What are the odds for tonight's match? | `/playground` | Paid 0.02 USDC to Odds |
| Playground: Summarize https://docs.wal.app in three lines | `/playground` | Paid 0.01 USDC to Brief |
| Playground: What does a Sui upgrade cap do? | `/playground` | Answered; paid nothing |

**What the runs found, all fixed before the green run:**
- **A Researcher marked "active" can still be unable to spend.** The suite's global setup revokes the
  burner's limits, so the spec makes a fresh Researcher first.
- **A command card that only filled the box needed two Enters,** because the first one picks from
  the command menu. Command cards now run their command at once.
- **The spec's own polling tripped the local server's per-address limit.** Each example now counts as
  its own client, as the demo and u13 shots already did.

## Templates (`SEED=1`)
| Template | Kind | What it shows | Publish transaction |
|---|---|---|---|
| Package auditor | Researcher | A persona, a budget, a weekday schedule | `4A649H12JHpu9ZHyjEqt2nzNNka74UaJrzJAMCFLFBpN` |
| Match-day odds | Researcher | A Friday schedule; never tells anyone to bet | `CeyJa9NQcCSyBb8VCMXn4q4D3KUkN5uQbFJebJLSBVQm` |
| Docs digest | Researcher | Briefs of links, remembered | `BKAMyY7temyAicCvNPfwdstUyAH2pxw83mZ64Xn7MfRV` |
| Quiet wallet | Wallet watcher | Three rules in plain words | `DeQC9ReRuJe6suZjbMrzpRsminfWRV6Pg7M77NDW3myP` |
| Big moves only | Wallet watcher | Pings for big transfers only | `449ZZRVQBXvhtk9LbutXEmfkZc6DycFPvEW3puLjvg9x` |
| Token desk | A room of two | A Wallet watcher hands strange tokens to a Researcher | `FW6pGDjeTkHbgAohd92RZt3KKThEkwTDPDwxse5wMM5q` |

All six passed the safety review. The local gallery now shows these six. The 14 test-run templates
are deprecated, and the 14 blocked templates stay hidden.

**The live gallery is still empty.** `GET https://getremora.vercel.app/api/hatchery` returned
`{"templates":[]}` after the publishes, so the live server's indexer doesn't pick up testnet
publishes on its own. It records a template when its publish is confirmed to it.

## Gates
| Gate | Result |
|---|---|
| typecheck, lint, test | Green: 404 web tests (6 new for the examples, the playground cards and the gallery), 340 server |
| `bun scripts/check-links.ts` | Every link resolves |
| e2e `smoke` and `mobile` | 38/38 |
| `EXAMPLES=1` | Every example passes on testnet (the table above) |
| `SEED=1` | Six templates published and 14 deprecated; a second run publishes nothing |
| `DEMO=1` capture | All ten shots, no missing mark |
| `u7.spec` | **Not re-run.** Its new last step (deprecate the template it published) calls the same API that `SEED=1` used for 14 deprecations |

## The video
- **The new chapter:** "08 · And more", recorded from the real app:
  - the template gallery;
  - Token desk's consent: two remoras, the services and prices, "Passed the safety review" and
    "Use it (one signature)";
  - a room's paid answer;
  - a live Claude Code connection;
  - Telegram in Settings.
- **The address bar** names each segment's page.
- **The teach chapter no longer leans on an old event.** The capture sends a real 0.001 SUI to the
  address the Wallet watcher watches, and the rule it just learned ignores it about 8 s later. The
  wait is cut to 2 s with a "sped up" badge.
- **Before it films the new Researcher,** the capture retires the `Researcher · demo` and
  `Researcher · examples` remoras earlier runs left: 19 over two runs.
- **The render:** `render.ts --workers 8`, 10,677 frames in 567 s. It wrote:
  - `out/remora-demo.mp4`: the master, 1080p60, 109.5 MB;
  - `out/remora-demo-web.mp4`: the share copy, 1080p30, 16.0 MB.

  **178.0 s**, inside the 150–180 s the form asks for. No mark or box was missing.
- **Checked after the render:** frames taken from the final MP4 show each chapter-08 page with its
  caption and spotlight, and the teach chapter's "Learned" and "ignored".

## For Uy
1. **Upload the new video** (178 s) instead of the 161 s one. Its files are listed under The video
   above.
2. **The live gallery is empty.** Two ways to fill it:
   - after the deploy, confirm the six publishes to getremora.vercel.app. Sign in as the burner on the
     live site and `POST /api/hatchery/publish/confirm` with each digest in the table above;
   - or publish them again there through the app's Share flow.

   Both write to the live database, so they wait for your yes, with the deploy.
3. **The deploy** carries the chat cards, the playground cards, the gallery filter and the site
   address fix. The commands are in [the U14 exit note](2026-11-04-u14-exit.md#the-list-for-uy).
