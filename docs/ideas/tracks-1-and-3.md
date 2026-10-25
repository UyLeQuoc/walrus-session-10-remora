# Ideas for Tracks 1 and 3, built on Remora's rails

> **Status (Oct 25, 2026):** both are built (goal U11, [ADR-0060](../adr/0060-build-receipts-and-kitty.md)).
> - **Exits:** Kitty passed its testnet exit, and so did Receipts' first stage. Receipts' last stage runs
>   once tonight's NBA games are final ([the exit record](../spikes/2026-10-25-u11-exit.md)).
> - **Web:** both now have a web with wallets ([ADR-0064](../adr/0064-receipts-kitty-web-with-wallets.md)).
> - **Repos:** both live in their own public repos ([ADR-0065](../adr/0065-split-receipts-and-kitty-repos.md)):
>   [total-recall-receipts](https://github.com/UyLeQuoc/total-recall-receipts) and
>   [total-recall-kitty](https://github.com/UyLeQuoc/total-recall-kitty).
> - **Next:** goal U12 turns them toward agents
>   ([ADR-0066](../adr/0066-agents-use-the-apps-through-mcp.md)).
>
> **Entering them is not decided.** We compete in Track 2 with Remora
> ([ADR-0001](../adr/0001-track-2-only-remora.md)), and entering another track would supersede that ADR. The
> ideas parked on Oct 18 are in [archive/](../archive/): Called It and Oath (Track 1), Tab and Mandate (Track 3).
> This doc revisits them now that Remora's rails exist.

## Read this first: what an extra entry costs

1. **One submission per person** ([event rules §3](../event-rules.md#3-eligibility)). Uy and Huấn are on
   Remora, so each extra entry needs a **different person who builds it and submits it**. That person
   brings their own Tatum ID, SUI address, Walrus Memory account (≥10 mainnet memories) and
   `MEMWAL_AGENT_ID`. The rules require "your original work", so a name can't go on work that person
   didn't do. **Before anything starts, ask on Discord** whether one team may enter several tracks.
2. **Each entry is a full submission:** a public repo, a working demo, a published blog post and a
   2–3 minute video.
3. **Time.** There are 16 days to the Nov 9 target, and Remora's U9 (testnet launch) and U10 (mainnet
   pass) are still open. Remora comes first. An extra entry must not take Uy's time from U9.
4. **Learning curves need real data.** Every track rewards "how it learned over time", and so does the
   Best Walrus Memory prize. A curve can't be faked on Nov 8, so real use starts on day 1.
5. **What changed since the archive:**
   - Sui access is **gRPC only** ([ADR-0021](../adr/0021-sui-grpc-only.md)). The archive's `suix_queryEvents` and
     `suix_queryTransactionBlocks` calls don't exist there. History comes from filtered
     `SubscribeCheckpoints`.
   - Tatum's free plan is 1M credits a month. Streams stay filtered to ≤10 addresses each
     ([ADR-0058](../adr/0058-tatum-credit-budget.md)). A separate submitter has a separate Tatum account,
     so the budgets don't mix.
   - MemWal has quirks and outages ([tech-reference §1.11](../tech-reference.md),
     [ADR-0055](../adr/0055-memory-failures-in-health.md)). Run `diagnose` before any demo.

## What we can reuse

Each entry is its own repo. It copies these pieces from a tagged Remora commit, with attribution in its
README. All three repos are MIT ([ADR-0068](../adr/0068-mit-license.md)), so a copy keeps the notice.

| Piece | Where in Remora | Used by |
|---|---|---|
| Tatum native gRPC transport, pacing, usage counter | `packages/chain` (`paced.ts`, `tatum.ts`) | both |
| Walrus Memory client, limiter, redaction, untrusted-text wrapping | `packages/memory` | both |
| Telegram bot: polling, keyboards, chunking, account linking | `apps/server/src/channels` | both |
| Filtered checkpoint watcher, ≤10 addresses per stream | `apps/server/src/triggers/watch.ts` | both |
| Gas station (sponsored transactions) | `apps/facilitator` (`gas-pool.ts`) | both |
| Receipt verify page pattern | `apps/server/src/runtime/verify.ts` | Receipts |
| Sonar (untrusted text check) | `packages/sonar` | Receipts (pundit text) |
| Proof of Learning view | `apps/web/src/features/learning` | both |
| App-bound allowance builders and readers; the Disc's Move patterns | `packages/disc-sdk`, `packages/move/remora` | Kitty |
| Funds detection | `packages/chain/src/funds.ts` | Kitty |

---

## Track 1 — Markets & Sports Prediction

# 🧾 Receipts: the group-chat pick'em that keeps the receipts

**Your group chat logs its picks before tip-off. Every pick gets a receipt anchored on Sui, so nobody can
claim "I called it" after the fact. After the final whistle, Receipts scores everyone against the books
and Polymarket. Then it learns who in the group to trust, and on what: which friend, which pundit, which
source.**

It evolves the archived *Called It*, with three changes. It lives where pick'em leagues already happen
(the group chat). It reuses the Telegram, memory and verify code we've already proved. And it has a big
real event inside the window: **US midterm night, Nov 3**.

### The aha moment
- **Oct 25, in the group chat:** `/pick Lakers -3.5 70%` → "🧾 Locked 18:58, 2 minutes before tip-off.
  Receipt ↗".
- **Nov 6:** Receipts makes its own call, and it now cites what it learned:
  > **Knicks 61%**. Books 55% · Polymarket 58% · the group 64%
  > 🧠 *Leaning on Minh for NBA totals (8 of 10 since Oct 25), away from Huy on his own team (2 of 7)*
  > ⚠️ *Books and Polymarket disagree by 6 pts. On NBA spreads the books were right 7 times out of 10*
- **When Huy logs "Lakers 90%":** "🧠 Your 90%+ picks on the Lakers have hit 2 of 7. Still 90%?"

### MVP
1. **A Telegram group bot plus a web board.** The board holds leaderboards, receipts and the learning
   chart.
2. **Events:**
   - NBA, with games every night, so there are results every day;
   - EPL weekends;
   - **US midterms (Nov 3)**: Senate, House and governor races;
   - weekly Sui market questions, such as "SUI above $X on Friday 00:00 UTC?" and "WAL vs DEEP over
     7 days".
3. **Voices on one scoreboard:**
   - each group member;
   - the books (an odds API, vig removed);
   - Polymarket and Kalshi (public prices);
   - pundits: paste a link, and an LLM extracts the pick behind Sonar, because pundit text is untrusted;
   - for market questions, up to 10 watched Sui wallets, through one filtered stream.
4. **Pick before lock → receipt:**
   - the pick is written to Walrus Memory;
   - every 10 minutes, the Merkle root of new picks is anchored on Sui by a ~40-line `receipts::anchor`
     module. It emits `Anchored { root, ts_ms }` from the `Clock`, with sponsored gas;
   - `/verify/<pick>` checks the Merkle proof against that transaction, fetched through Tatum gRPC;
   - a pick sent after lock is refused.
5. **Resolve and score:**
   - sports resolve from a results API;
   - **Sui market questions resolve from the chain itself**: a Pyth or DeepBook price object read through
     Tatum gRPC at resolution time;
   - every voice gets a Brier score and calibration per (voice × league × market type), with shrinkage
     for small samples.
6. **Learn:**
   - each resolution writes a trust snapshot memory;
   - Receipts' own call is weighted by those snapshots and cites them;
   - bias nudges come from `analyze()` over each member's history;
   - the disagreement radar keeps a learned lean.
7. **Proof of Learning:** a chart of Receipts' weighted call against the plain average and against the
   books, from real picks since Oct 25.
8. **Stretch:**
   - **sealed picks:** Seal time-lock encryption, so nobody copies a pick before lock (the archived Oath
     idea, scaled down);
   - shareable scorecard images, for the X/LinkedIn bonus.

### Memory design
| Namespace | Example | Used for |
|---|---|---|
| `group:<id>:picks` | `PICK 2026-10-25T18:58Z · voice=huy · LAL -3.5 · conf=0.70 · anchor=<digest>` | Receipts, "what did I say last time" |
| `group:<id>:trust` | `TRUST · voice=minh · ctx=NBA totals · n=10 · brier=0.18 · hits=8/10 · trend=up · as_of=2026-11-05` | Weights for Receipts' own call (recall `sort: "recent"`) |
| `group:<id>:radar` | `DISAGREE · NBA spread · books 55 vs poly 58 · winner=books` | The radar's lean |
| `user:<id>:insights` | `INSIGHT: overconfident on own team (2/7 at ≥90%)` | Nudges while logging a pick |

Postgres does the math. **Memory holds the conclusions the product acts on**, and every weight on screen
links the memory behind it.

### Tatum (gRPC only)
| Call | Why |
|---|---|
| `ExecuteTransaction` (sponsored) | Anchor pick batches |
| `GetTransaction` | `/verify`: the anchor's event |
| `GetObject` | Resolve Sui market questions from a Pyth or DeepBook price object |
| `SubscribeCheckpoints`, filtered to ≤10 wallets | Wallet voices for market questions |
| Data API rate history | Cross-check price resolutions |

### Plan (Oct 25 – Nov 9)
| Days | Deliverable |
|---|---|
| Oct 25–26 | Repo from the rails; the group bot; picks written to mainnet memory **from day 1**; NBA and EPL ingest. Start a real league with friends |
| Oct 27–30 | Anchors and `/verify`; resolution and Brier; trust snapshots; Receipts' own call; midterm races loaded |
| Oct 31 – Nov 4 | Radar, nudges, wallet voices, onchain-resolved market questions. **Midterm night live on Nov 3** |
| Nov 5–9 | The learning chart from real data, scorecards, README, blog, video, submit |

### Demo (2:45)
1. **0:00** Hook: "Everyone in the group chat called it. Nobody can prove it."
2. **0:15** A pick in Telegram → its receipt → `/verify` shows the anchor, read through Tatum.
3. **0:45** A late pick is refused at lock.
4. **1:05** Midterm night: the group vs Polymarket vs Kalshi, scored the next morning.
5. **1:35** Oct 25 vs Nov 6, side by side: Receipts' call moved, and each move cites a memory.
6. **2:05** The nudge fires on an overconfident pick.
7. **2:25** The learning chart: the weighted call beats the plain average.

### Risks
- **Few resolutions.** NBA's nightly games fix this. Start the league on Oct 25.
- **Odds API limits.** Take one snapshot at lock and cache it.
- **Thin Polymarket coverage for sports.** Fall back to books, the group and pundits; the radar still
  works.
- **Legal.** It's a journal, not a sportsbook: no deposits and no wagering.
- **The relayer's limits** (~1000 weighted requests an hour). Write picks in batches.

---

## Track 3 — Consumer Finance Apps

# 🐱 Kitty: the group pot that saves itself

**A trip fund or house fund where nobody has to hold the money. Each friend signs once. Kitty pulls
each share right after that person's payday, never more than the cap they set. It spends only the way
the group agreed, because a Move contract holds the pot, not a friend.**

The track's own examples are "shared budgets", "savings goals that adapt to real cash-flow patterns" and
"payment flows that feel normal". Kitty covers all three. It's built on Sui's native Allowances: the
same app-bound pull that Remora's Disc proved, pointed at a consumer problem.

### The pain
- One friend holds the group's cash, and everyone has to trust their spreadsheet.
- Reminders are awkward, and somebody is always late.
- An auto-transfer on the wrong day overdraws someone.

### How it works
1. **Join with one signature.** Sign-in is zkLogin and gas is sponsored. Each member signs one app-bound
   Allowance to Kitty:
   - its rate limit is that member's maximum contribution per week or month;
   - its expiry is the goal date;
   - **the money stays in the member's own balance until a pull**;
   - leaving is one tap (revoke).
2. **Pulls.** Kitty's keeper pulls each share into the pot through `kitty::pot::contribute`, the same
   `app_balance_spend` path as the Disc's `pay`.
   - Sui enforces the cap and the window.
   - A pull the member can't afford simply fails. **No overdraft, no fee.**
3. **Spending.** A member proposes "hotel, $120, to X". The others approve with a button in Telegram or
   the web, and the pot pays when quorum is reached.
   - The group can set **auto-ok rules** that the contract enforces, such as "food up to $30". Kitty
     only suggests them.
4. **Close.** When the trip is over, the leftover goes back pro rata.

### What it learns (Walrus Memory)
- **Each member's cash flow.** Paydays come from inflows on the watched addresses, and failed pulls feed
  in too. Example: "Lan's pulls fail before the 25th, so pull on the 26th." Amounts adapt to keep the goal
  on track ("Huy is 2 weeks behind: +$5 a week, or move the goal?").
- **The group's norms:**
  - what gets approved fast, and by whom;
  - which categories it spends on;
  - the rules it might want: "You've approved every food spend under $30 within a minute. Make that
    automatic?" The group confirms, and the contract enforces it.
- **Preferences:** local currency, reminder times.

Every action cites a memory. For example: "🧠 Pulled Lan's share today because she's paid on the 25th (2
failed pulls, Oct 24 and Nov 1)."

**The learning metric:**
- first-try pull success goes up;
- time to approval goes down;
- the share of goals on track goes up.

### Move: `kitty::pot` (new, ~200 lines + tests)
- `Pot` is a shared object holding:
  - the goal, the members and their allowances;
  - the `Balance<USDC>`;
  - the quorum and the auto-ok limits.
- `contribute(pot, allowance, withdrawal, clock)` takes an app-bound pull and emits `Contributed`.
- `propose_spend` → `approve` → `execute` (at quorum), or `spend_auto` within the auto-ok limits.
- `close` refunds pro rata.
- It follows the Disc's patterns:
  - permit guards;
  - a version field with forward migrations;
  - events for every money move.

### Tatum (gRPC only)
| Call | Why |
|---|---|
| `SubscribeCheckpoints`, filtered to members (≤10 per stream) | Paydays and external payments |
| `GetBalance` | Skip a pull that would fail, which saves gas |
| `SimulateTransaction` → `ExecuteTransaction` (sponsored) | Pulls and spends |
| `GetObject` | Pot and allowance state (`current_spend`) |
| Data API rates | Show VND or THB, never "USDC" |

### Plan (Oct 25 – Nov 9)
| Days | Deliverable |
|---|---|
| Oct 25–27 | `kitty::pot` with Move tests; testnet publish; joining with one signature |
| Oct 28–31 | Keeper pulls, payday detection, failed-pull learning; the Telegram group bot with approval buttons |
| Nov 1–4 | Mobile-first web: the goal, members, and a "what Kitty learned" page; suggested auto-ok rules. Start a real kitty among friends |
| Nov 5–9 | Metrics, README, blog, video, submit |

### Demo (2:40)
1. **0:00** Hook: "Every group trip has one friend holding everyone's money."
2. **0:15** "Da Lat, 6M VND by Dec 20". Three friends join with one tap each, with no wallet popup.
3. **0:45** Lan's share lands the morning after payday, citing a memory (🧠). Huy's pull fails with no
   fee, and Kitty reschedules it.
4. **1:20** "Hotel $120": two taps in Telegram, then paid on Sui through Tatum.
5. **1:50** "Kitty suggests: food under $30 is automatic." The group says yes. A $45 dinner still needs
   votes, because the contract enforces the rule.
6. **2:15** Huy leaves with one revoke. The progress and learning chart close the demo.

### Risks
- **Two weeks of real paydays is thin.** Start a real kitty on day 1, simulate paydays with test
  accounts, and say so plainly in the blog.
- **zkLogin needs an Enoki key.** Without one, sign-in is wallet-only, and "blockchain stays invisible"
  gets weaker.
- **Overlap with Remora.** Frame Kitty as a consumer pot with no agent payments and no merchants.
- **Custody.** The pot is a Move object with group rules, and money moves only on testnet.

---

## Alternatives (short)

- **Track 3: Tab** ([archive](../archive/winning-ideas.md#track-3--consumer-finance-apps)).
  - Splitwise that settles itself: settle with a sponsored USDC transfer, detect payments made outside the
    app through the filtered watcher, and learn the group's split norms.
  - Lower risk than Kitty, with no new Move, but more crowded (Splitwise clones).
- **Track 1: Oath** ([archive](../archive/technical-ideas.md#track-1--markets--sports-prediction)).
  - Seal forced-reveal predictions with onchain decryption.
  - The most original cryptography, but it rests on a Seal spike. Receipts keeps it as a stretch (sealed
    picks).

## How they score

| | Receipts (T1) | Kitty (T3) |
|---|---|---|
| Walrus + Tatum (30%) | Memory sets the weights, the nudges and the radar. Tatum anchors, verifies and resolves from onchain prices | Memory sets pull timing, amounts and suggested rules. Tatum streams paydays and executes pulls and spends |
| Technical (30%) | Merkle anchors, Brier and calibration, onchain resolution | Native Allowance pulls, a Move pot with quorum and auto-ok rules, sponsored transactions |
| Creativity (20%) | Friends, books, markets, pundits and wallets on one scoreboard, with receipts | A pot nobody holds, and pulls that know your payday |
| Presentation (20%) | Midterm night, plus shareable scorecards | A familiar trip-fund flow, plus the "no fee on a failed pull" moment |
| New code | Low: ingest, scoring, a ~40-line anchor | Medium: a Move module, a keeper, approvals |
| Overlap with Remora's story | Low | Medium (allowances) |

## Recommendation

**If we enter only one: Receipts (Track 1).**
- It's the least crowded track.
- It moves no money, so the only new Move is a 40-line anchor.
- Most of it is code we've already proved: Telegram, memory, verify, gas station.
- Daily NBA results plus midterm night give a real learning curve in time.
- It reads as its own product, not as Remora in another costume.

**Kitty** is worth it only if:
- a second owner exists;
- Remora's U9 is on track by about Oct 30.

**Before any of it:**
1. Ask the organizers on Discord about multiple entries from one team.
2. Name the person who owns each entry and submits it.
3. If we go: write an ADR that supersedes ADR-0001, and start real use on day 1.
