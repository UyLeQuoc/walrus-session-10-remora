# Goal U17: Remora at scale: an open Reef, crews, more doors, numbers under load, then the deploy

- **Owner:** Uy's agent, for every part, Huấn's lane and `packages/schema` included, the way U16 ran
  ([ADR-0107](../adr/0107-u16-without-handoffs.md)).
- **Decision:** [ADR-0111](../adr/0111-scale-pass.md).
- **Runs in:** a git worktree of `/Users/uydev/orca/projects/walrus-session-10` (see "Before you
  start"), on the branch `u17-scale`. It's merged through a PR, then deployed.
- **Time box** (Vietnam time; the deadline is Nov 10, 17:00 UTC, and the target submission is Nov 9):

  | When | What |
  |---|---|
  | Nov 5 | Part A (an open Reef), D1 (the gas pool) |
  | Nov 6 | Part B (crews), Part C (more doors) |
  | Nov 7, until 18:00 | D2–D3 (the load run, `/stats`). **The code freeze is at 18:00** |
  | Nov 7 evening–Nov 8 | Part E: the landing page, docs, PR, merge, deploy, smoke |

  **If time runs short, keep this order:**
  1. A1 and A3;
  2. D;
  3. B;
  4. C1;
  5. C2;
  6. A2;
  7. C3;
  8. the video.

  Whatever is cut goes on the list for Uy.

**Goal:** a judge sees that Remora is a network, not one agent with a few house services:
- **Remoras sell to each other.** A remora buys another owner's remora's answer, and that remora pays
  its own sources: a chain of receipts, each under a limit Sui enforces.
- **Anyone can join.** Anyone can list an x402 API on the Reef, and any Sui x402 merchant can settle
  through our facilitator.
- **Crews.** One signature starts a crew that splits one question across its members.
- **More doors.** A remora answers from Cursor or VS Code, from Telegram's Mini App, and at a SuiNS
  name.
- **Load.** The rails hold under load: more than 1,000 paid calls, dated, and zero overspends.

## Before you start
- **Read:**
  - ADR-0111, ADR-0106, ADR-0107, ADR-0109, ADR-0110, ADR-0097 (the public fullnode fallback) and
    ADR-0099 (deploys);
  - `docs/deploy.md` and `docs/spikes/2026-11-04-u16-exit.md`;
  - `packages/merchant/src/x402.ts` (it settles before the handler runs);
  - `apps/server/src/money/reef.ts`, `apps/server/src/runtime/{scout,brain,teams,briefer}.ts` and
    `apps/server/src/tools/pay.ts` (the ADR-0109 guard);
  - `apps/facilitator/src/{facilitator,gas-pool,app}.ts` and `packages/disc-sdk/src/builders.ts`
    (`buildSetPayees`);
  - `apps/web/src/features/{connections,remoras,reef,teams}` and
    `e2e/tests/{examples,demo,seed}.spec.ts`.
- **Where to work:** `git fetch origin`, then `git worktree add <scratch>/u17 -b u17-scale
  origin/main`, and work only there.
  - Uy keeps uncommitted edits in `docs/README.md` and `docs/ideas/track-1-hunch-prd.md` in the main
    tree. Main also changes `docs/README.md`, so a rebase with autostash there conflicts on Uy's file.
  - Never touch those two files.
  - Run `bun install` in the worktree, and copy the root `.env` into it. Don't commit it.
- **The local stack:**
  - e2e ports 8797/8798/8799/5183, with Docker Postgres;
  - **never kill 8787/5173**.
- **Check the money first, and write the numbers in the exit note:**
  - the burner's USDC (at least 10) and the gas station sponsor's testnet SUI (at least 5 before
    D2);
  - Tatum: if it answers 402, the fallback applies (ADR-0097), and every number says which node
    served it.
- **A second test owner:**
  - make a new testnet key as `E2E_BURNER2_KEY` in the worktree's `.env`; it's local only and never
    committed;
  - fund it from the burner with 3 USDC and 1 SUI;
  - it's the buyer in A1. Real owner accounts are never used.

## Part A: an open Reef
### A1. A remora sells its answers (E11)
- **The listing:**
  - An owner can put a Researcher or a Briefer up for sale with a price per answer (0.005–0.05 USDC),
    a slug and a one-line blurb.
  - These live in the remora's `config`, so there's no schema change.
  - Selling is off by default. The owner turns it on from the remora's page.
- **The endpoint:** the server serves `GET /x402/r/:slug?q=` as an x402 merchant.
  - Its 402 names the **owner's address** as `payTo`, on testnet.
  - A paid call runs the selling remora's own turn. That remora pays its own sources from its own
    Disc, within its own limit.
- **Settle after the answer:** add `settle: "after"` to `@remora/merchant`'s `x402`. It verifies,
  runs the handler, and settles only on a 2xx. Tests cover a failed handler, which never settles.
  - The unpaid first call does no work.
  - The house merchants keep settle-first (ADR-0106).
- **Limits:**
  - per payer per minute;
  - the seller's turn has a step limit;
  - a remora can't buy from itself;
  - a sold answer can't buy another remora's answer (depth 1);
  - a sold answer doesn't write the buyer's question into the seller's memory.
- **The Reef:**
  - every remora on sale is listed as `remora:<slug>`, in the category "Remoras", "by 0x…owner";
  - Sonar and the ADR-0109 listed-address check apply unchanged.
- **Buying:**
  - a planner rule: "ask @slug …" buys from that listing;
  - the buyer's owner adds the seller to the Disc's payees with **one signature** (`buildSetPayees`;
    wire it into the remora page).
- **Exit A1** (testnet):
  - the burner's Researcher sells;
  - the second owner's Researcher asks it a question that needs data;
  - receipts: buyer → seller (the listing's price), then seller → its sources. Each verifies through
    `/api/verify`, and the buyer's thread shows the chain.

### A2. List your own API (E8)
- **The page:** `/reef/new`. The owner pastes an x402 URL.
- **The probe:** one unpaid GET must return a 402 for `sui:testnet`, the exact scheme, USDC, a
  `payTo` and a price. The page shows what the probe found.
- **The listing:** the owner signs, and the listing shows as "community, by 0x…" with its probe date.
  - It's never in a template's default payees.
  - Storage needs no schema push. Pick an existing JSON column and record the choice in an ADR. If
    that can't work, cut A2.
- **Exit A2:** list A3's example merchant and buy from it once.

### A3. The public facilitator (E13)
- **For any merchant:** `/verify`, `/settle`, `/supported` and `/gas` (the gas station) are documented for any Sui x402
  merchant on testnet (`apps/facilitator/README.md`).
- **Limits:**
  - rate limits per IP and per `payTo`;
  - a daily cap on sponsored gas per `payTo`;
  - the cap answers a plain 429.
- **The example:** `examples/sell-an-api/`, a merchant of about 20 lines on `@remora/merchant` and the
  public facilitator, with a README and a test.
- **Exit A3:** the example runs, a remora pays it, and the receipt verifies.

## Part B: crews
- **What a crew is:** a team (a team file applied with one signature, `applyTeam`) plus a lead.
  Members' configs carry the crew id, so there's no schema change.
- **The lead:**
  - plans the buys with `planBuys`;
  - hands each planned service to the member that has it as a payee, all in parallel (the existing
    same-owner `handoff`);
  - writes one answer that cites every member's receipt.

  Each member pays from its own Disc.
- **The crew view:**
  - members, with each one's limit and spend, and the crew's total;
  - Pause the crew (a runtime pause, one click);
  - revoke every Disc in one PTB (one signature).
- **A template:** "Research crew", a lead with onchain, markets and code members, published with
  `SEED=1`.
- **Exit B** (testnet):
  - apply the crew with one signature;
  - ask the lead a question that needs three services;
  - three members pay three services from three Discs;
  - the lead's answer lists the three receipts, and the crew view sums them.

## Part C: more doors
### C1. One-click MCP
- **The links:** the Connections page adds, beside the existing `claude mcp add`:
  - a Cursor install link;
  - a VS Code install link;
  - a JSON config.
- **The token** goes only into the local app's config, never into a URL sent to a host we don't run.
- **Tests:** unit tests for each config. A real `claude -p` run shows the server still answers.

### C2. The Telegram Mini App (H3)
- **The page:** `/tg`, opened from the bot's menu button.
- **Sign-in:** the server checks Telegram's `initData` signature (an HMAC with the bot token) and maps
  the user to the linked owner (A5).
- **It shows:**
  - the remoras;
  - the last receipts;
  - the approval inbox (approving opens the web to sign);
  - Pause all.
- **Tests:** `initData` that's valid, expired and tampered with.

### C3. SuiNS names (B5), on testnet
- **The names:**
  - register a parent name on testnet with a dedicated testnet key;
  - give each new remora a leaf subname that points at its address;
  - show it in the UI.
- **Resolve over gRPC:** `NameService.LookupName` is in `@mysten/sui` 2.36. Never JSON-RPC.
- **The SDK:** the SuiNS SDK is a new dependency, so it needs an ADR first.
- **Cut** C3 if gRPC can't resolve testnet names.

## Part D: numbers under load
### D1. The gas pool
- A script splits the sponsor's testnet SUI into N gas coins, with N from config.
- Write down the pool size and hold time you chose, and why.

### D2. The load run (`LOAD=1`, a script or an e2e spec)
- **The remoras:** 50 of them, under the burner. Team apply makes them in batches, with one signature
  per batch.
- **What it drives:** the payment rails directly (Disc, facilitator, gas station and the eight
  merchants), **with the model out of the loop**. Label it that way everywhere.
- **The calls:**
  - concurrency ramps 1 → 5 → 10 → 20;
  - at least **1,000 paid calls** in all;
  - plus at least 50 over-limit or off-list attempts, which must fail (Sonar or an onchain abort).
- **Record:**
  - payments a minute at each step;
  - settle latency p50, p95 and p99;
  - sponsored SUI per payment;
  - failures by code;
  - **overspends:** every Disc's spend, read back over gRPC, must be at or under its limit. The
    count must be 0.
- **Results:** `docs/spikes/<date>-u17-load.json` and a dated section in the exit note.
- **After:** retire the 50 remoras (revoke in one PTB).

### D3. `/stats`
- **The page:** a public, read-only `/stats` page and `GET /api/stats`. Per network, from the DB:
  - remoras;
  - paid calls;
  - USDC moved;
  - receipts verified;
  - blocked attempts;
  - overspends.

  Plus the latest dated load run.
- Every number comes from data. Nothing is typed in by hand.
- **Exit D:** the run passes with 0 overspends, and `/stats` shows it locally.

## Part E: show it and ship it
- **The landing page:**
  - new sections: "An open Reef" (the receipt chain), "Crews", "More doors" and "At scale" (the load
    numbers, dated);
  - a new reviewer that sees only screenshots checks the changed sections at 1440 and on a Pixel 7.
    Fix its blockers and majors.
- **Docs:**
  - the README's "what's real";
  - the submission draft;
  - `apps/facilitator/README.md` and `apps/merchants/README.md`;
  - the goals README;
  - the demo README, if the video changes.
- **Merge:** a PR, CI green, then merge.
- **The deploy** (Uy said yes on Nov 4, ADR-0111), following `docs/deploy.md`:
  - **No schema push by the agent.** If the PR needs one, stop before deploying and put it on Uy's
    list.
  - Run `bun run diagnose` with the production env.
  - Deploy from a clean checkout of `main`: `railway up --service api --ci`, then, in `apps/web`,
    `vercel build --prod && vercel deploy --prebuilt --prod`.
  - Set new env vars with the Railway CLI, never printing them. `DEMO_ATTACK` stays unset.
  - Check `/api/health/deep`, then run `E2E_BASE_URL=https://getremora.vercel.app bun run e2e:main`.
  - Confirm the curated templates' digests to the live API, so the gallery fills.
  - Set the bot's menu button to the Mini App.
  - If a check fails, roll back (`docs/deploy.md`) and list it.
- **The video** (optional, only if it's done by Nov 8, 12:00):
  - replace "10 · And more" with about 12 s of the receipt chain and a crew;
  - stay at 180 s or under;
  - render with `--workers 8`, then check frames from the final MP4.

## Hard rules
- **Honesty:**
  - no fake numbers or receipts: everything shown comes from a dated run;
  - load numbers are labeled as the rails without the model;
  - the attack service never ships.
- **Sui and Walrus:**
  - Sui over gRPC only;
  - testnet only, with no mainnet publish or payment;
  - the agent never pushes the DB schema.
- **Contracts:** `packages/schema` changes go in the same PR and are listed in the exit note.
  `lib/api.ts` changes only with the server's `AppType`.
- **Dependencies:** no new dependency without an ADR.
- **E2E specs keep what they assert.** A moved selector moves in the same commit. demo.spec keeps
  its mark and box names.
- **Git and secrets:**
  - no force-push;
  - no `.env` or keys in commits;
  - no edits to `reference/`;
  - never print a secret.
- **ADRs:** never rewrite an accepted ADR. Every decision gets an ADR in the same commit. Check
  main's newest ADR number before you pick one, since Huấn adds ADRs too.
- **Before each push:** rebase on `origin/main`, then `bun run typecheck && bun run lint && bun run
  test`, plus `bun scripts/check-links.ts && bun scripts/tatum-calls.ts --check`.

## Finish
- **The exit note:** `docs/spikes/<date>-u17-exit.md`, covering:
  - A: the receipt chain, the listing and the facilitator example;
  - B: the crew's receipts;
  - C: each door, with how it was checked;
  - D: the load numbers;
  - E: the review, the deploy (URLs, health, smoke) and the video;
  - what was cut;
  - the list for Uy.
- **Stop every server** the goal started, and remove the worktree.
- **Finish with a short Vietnamese summary for Uy.**
