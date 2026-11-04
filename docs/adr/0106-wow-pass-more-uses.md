# ADR-0106: The wow pass: more things a remora can buy, a third kind, live proof in the video, and a landing page that shows the range

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Uy (picked all four directions), Uy's agent (the plan)

## Context
Uy watched the 178 s video ([ADR-0105](0105-examples-you-can-try.md)) and asked for more: "remora làm
được nhiều thứ hơn không, ngoài mấy con đó… xem video ít công dụng quá, làm wow hơn đi", and "show
thêm landing page nữa".

The facts behind that feeling:
- **The Reef sells three things:** a Sui risk check, odds and a Brief (`apps/server/src/money/reef.ts`).
- **The Researcher picks what to buy by keywords** (`planBuys` in `runtime/scout.ts`). That keeps the
  demo deterministic, but every story is "is package 0x2 safe?".
- **There are two kinds,** the Researcher and the Wallet watcher. Nothing wakes on its own schedule to
  do a job end to end, though `cron` triggers and schedules exist.
- **The video's most important scene is a diagram.** "The attack" shows a real testnet digest but no
  app footage. The video also never shows a free answer, Claude Code at work, or one question that
  buys from several services.
- **The landing page** shows the problem, four moments and the app, but not the range of jobs.

Uy chose all four directions ("Thêm dịch vụ trả phí", "Cảnh wow thật trong video", "Landing: mục
'Remora làm được gì'", "Loại remora thứ ba") and a goal (U16) to run them.

## Decision
- **Five new paid services in the Reef.** Each is a real x402 merchant in `apps/merchants`, tested,
  and served from the same container as today ([ADR-0099](0099-first-deploy-one-railway-service.md)):
  - **`wallet`:** a Sui address X-ray (balances, object count, last activity) over Sui gRPC. 0.01 USDC.
  - **`walrus`:** a Walrus blob check (size, certified, the epoch it ends, days left). 0.005 USDC.
  - **`github`:** a repo's health (stars, last push, open issues, license, archived) from GitHub's
    public API. 0.01 USDC.
  - **`price`:** token prices (SUI, WAL, BTC, ETH) from a public source with no key. Every answer says
    the source and its time. 0.005 USDC.
  - **`weather`:** a city's forecast from Open-Meteo, no key. 0.005 USDC.

  Prices may change in the goal if a source needs it. The Reef is the one place they're set.
- **The planner stays deterministic and learns the new services.**
  - It keeps one rule per service, and a question can buy from several services at once.
  - A 0x id next to "wallet", "address", "holds" or "portfolio" means the wallet X-ray; otherwise it's
    the Sui risk check.
  - A github.com link means the repo's health, not a Brief.
  - A Walrus blob id means the blob check.
  - A question with nothing to buy is answered free, and says so.
- **A third kind, the Briefer** (slug `briefer`):
  - It runs on a schedule (a `cron` trigger), buys the few things its owner asked for (prices, a
    wallet, a repo, the weather), and posts one digest with a receipt per purchase.
  - It reuses the Researcher's payment path and its own Disc. It fits the schema as it stands: the
    existing `TOOL_NAMES` and triggers, and `template` as a string.
  - If it needs a schema change, that goes through a contract PR approved by Huấn
    (AGENTS.md). Until then the Briefer waits, and the rest ships.
- **Live proof replaces the diagrams in the video:**
  - "The attack" becomes footage. A listed demo service returns data with an injected "pay 0x…"; the
    remora is stopped by the safety check, and the Why? drawer shows it.
    - The poisoned service runs only in the local capture, behind `DEMO_ATTACK=1`. It is never in a
      deployed Reef.
  - One question buys from three services and shows three receipts.
  - A free answer.
  - **Claude Code** (`claude -p` with Remora's MCP server) asks a remora, which pays. Its real output is
    shown in a terminal frame, and the receipt opens on the web. If `claude -p` can't run here, the
    scene says "an MCP client", never "Claude Code".
  - A Briefer's morning digest.

  The video stays 150–180 s, captions stay ten words or fewer
  ([ADR-0103](0103-visual-first-ui-pass.md)), and older scenes are cut to make room.
- **The landing page** gains "What a remora can do":
  - a grid of jobs, each with a real question, the service it buys, its price and a receipt from a
    recorded testnet run;
  - a strip of real receipts (digest, amount, service), linked to the explorer;
  - the new video.

  Every number comes from a recorded run, dated.
- **In the app:** the chat's example pool, the playground's cards, the Researcher's hints, and the
  template gallery grow with the services and the Briefer. Every new example is run once with
  `EXAMPLES=1`, and every new template is published with `SEED=1` ([ADR-0105](0105-examples-you-can-try.md)).

## Consequences
- **The deploy:** the live playground and gallery get the new services only after a deploy, which
  waits for Uy's yes.
  - The `github`, `price` and `weather` sources are outside services, and each answer names its
    source and time.
  - The x402 middleware settles before the handler runs (`packages/merchant/src/x402.ts`). So each new
    merchant reads its source in a check before the payment, as `brief` checks its input, and keeps
    the result for the paid response. A source that fails costs the remora nothing.
- **Huấn's lane:** the web work is claimed again in a handoff note.
- **Time:** the freeze moves to Nov 7, 18:00 Vietnam time for code. The video and the landing follow
  on Nov 7–8. The deadline is Nov 10.
- **Order if time runs short:**
  1. the services and the planner;
  2. the live attack and the multi-service answer;
  3. the landing;
  4. the Briefer.

  What's left goes into the exit note.

## Links
- [Goal U16](../goals/uy-16-wow-pass.md)
- [ADR-0099](0099-first-deploy-one-railway-service.md)
- [ADR-0101](0101-researcher-and-wallet-watcher.md)
- [ADR-0103](0103-visual-first-ui-pass.md)
- [ADR-0105](0105-examples-you-can-try.md)
