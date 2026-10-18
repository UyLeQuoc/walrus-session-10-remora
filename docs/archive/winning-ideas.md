# Winning Ideas: One Top Pick per Track

> **Parked (Oct 18, 2026):** we're competing in **Track 2 only**, with **Remora**. See
> [remora-spec.md](../remora-spec.md) and [remora-plan.md](../remora-plan.md). This file is kept for
> reference and may be out of date.

Each idea is designed against the actual scoring (see [event-rules.md](../event-rules.md#7-judging)) and the
real Walrus Memory and Tatum APIs (see [tech-reference.md](../tech-reference.md)).

## What the judges are actually rewarding

| Signal | Where it comes from | What it means for the build |
|---|---|---|
| **A learning loop you can see** | Track copy ("learns who to trust", "learn your escalation rules", "habits stick"), the Best Walrus Memory prize ("memories that visibly change the product"), and the blog post requirement ("how it learned over time") | Every decision the app makes should **cite the memory that caused it**, and you need a **metric that improves over time** |
| **Tatum *Sui* RPC, not just "Tatum"** | Technical quality (30%) explicitly says "successful Tatum Sui RPC integration" | Sui RPC has to sit in the product's core path, not in a token balance badge |
| **Consumer polish** | "Consumer apps first", "money products people actually open", "blockchain stays invisible" | One great flow beats five half-built ones |
| **Proof it works** | Presentation (20%): docs + working demo | A 2–3 minute video with a before/after moment |

All three ideas share one shape:

```
 observe (Tatum) ──► decide (recall memories) ──► act (cite the memory) ──► user reacts ──► remember
        ▲                                                                                     │
        └──────────────────────────────── the product gets measurably better ◄────────────────┘
```

---

## Track 1 — Markets & Sports Prediction

# 🎯 Called It

**The pick journal that puts bookmakers, onchain markets, Sui wallets, pundits and you on one
scoreboard, timestamps every call before kickoff, and learns, per league and market type, who's worth
trusting.**

### The aha moment

On Matchday 1 the forecast card is a plain average. By Matchday 3 it reads:

> **Trust-weighted: 58%**. Books 62% · Polymarket 49% · @PunditX 70%
> 🧠 *Down-weighting @PunditX on derby totals: 2/9 since Oct 21*
> ⚠️ *Books and Polymarket disagree by 13 pts. On EPL disagreements, books were right 7 of 10 times.*

When you log "Arsenal win, 80% confident", it pushes back:
> 🧠 *Your 80%+ picks on away underdogs have hit 1 of 6. Still 80%?*

### Why it wins

| Criterion | How Called It scores |
|---|---|
| Integration (30%) | Walrus Memory holds pick **receipts**, per-context **trust snapshots**, and **bias insights** that directly set the forecast weights. Tatum Sui RPC anchors and verifies picks, tracks smart-money wallets, and Tatum Data API resolves market questions at exact timestamps |
| Technical (30%) | Brier scoring with calibration, Bayesian shrinkage for small samples, a Move anchor contract, and Merkle proofs verified through Tatum Sui RPC |
| Creativity (20%) | Humans, books, onchain markets **and wallets** compete on one leaderboard. "Proof-of-Pick" kills fake "I called it" claims |
| Presentation (20%) | Shareable scorecards (good for the X/LinkedIn bonus) and a trust chart that moves week by week |

### MVP features

1. **Event board.** Football (EPL plus Champions League, both with fixtures inside the window) and weekly
   Sui-ecosystem market questions ("SUI above $X on Friday 00:00 UTC?", "WAL vs DEEP, 7-day
   performance"). Each card shows:
   - bookmaker implied probability (vig removed, averaged across books);
   - onchain market probability (Polymarket, when a market exists);
   - the trust-weighted forecast, with 🧠 "why" chips;
   - a **disagreement radar** that fires when sources differ by more than 8 pts and shows the learned lean.
2. **Voices.** You, your league mates, pundits (paste a tweet or URL and an LLM extracts the pick), book
   consensus, Polymarket, and **Sui wallets**. For market questions, a watched wallet's net buy or sell in
   the window counts as its pick.
3. **Log a pick before lock.** Record pick, confidence and a one-line reason, then `rememberAndWait` into
   `picks` to get a receipt with `blob_id` and `created_at`. Picks after kickoff are rejected.
4. **Proof-of-Pick.** Every 10 minutes, commit the Merkle root of new receipts through a ~30-line Move
   function that emits `PickBatchAnchored { root, ts }` using the Sui `Clock`. A public `/verify/<pick>` page
   checks the Merkle proof against the event fetched through **Tatum Sui RPC (`suix_queryEvents`)**.
5. **Resolution and scorecards.** Football resolves from a results API. Market questions resolve from
   **Tatum Data API `/v4/data/rate/history`** at the exact timestamp. Every resolved pick is scored with
   Brier and calibration buckets per *(voice × competition × market type)*, and produces a shareable
   post-game scorecard image.
6. **Learning.** Each resolution writes a fresh trust snapshot memory. The blender reads the latest
   snapshots (`sort: "recent"`) and turns them into weights.

### Memory design

| Namespace | Example memory | Used for |
|---|---|---|
| `picks` | `PICK 2026-10-25T13:58Z · voice=me · ARS vs CHE · ARS win · conf=0.80 · reason="Saka back"` | Receipts that can be proved, plus "what did I say last time" |
| `trust` | `TRUST · voice=@PunditX · ctx=EPL totals · n=9 · brier=0.31 · hits=2/9 · trend=down · as_of=2026-11-02` | Forecast weights; recall with `sort: "recent"` per voice and context |
| `disagreements` | `DISAGREE · EPL · books 62 vs poly 49 · winner=books · 2026-10-26` | The radar's learned lean |
| `me` | `INSIGHT: overconfident on away underdogs (1/6 at ≥80%)`, from weekly `analyze()` | Bias nudges while logging |

Numbers live in Postgres for the math. **Memory holds the conclusions the product acts on**, and every
weight change can be traced to a memory you can quote on screen.

### Tatum usage

| Tatum | Call | Why |
|---|---|---|
| Sui RPC | `sui_executeTransactionBlock` (anchor tx, app-sponsored gas), `suix_queryEvents` (verify anchors) | Proof-of-Pick |
| Sui RPC | `suix_queryTransactionBlocks` + `sui_getTransactionBlock` (balance changes), `suix_getCoinMetadata`, `suix_resolveNameServiceNames` | Wallet voices with readable names |
| Data API | `/v4/data/rate/history`, `/v4/data/rate/symbol/OHLCV`, `/v4/data/rate/symbol` | Resolve market questions, live charts |
| *(optional)* Polygon RPC | Read Polymarket's onchain resolution | Cross-check settlement |

Other sources: an odds API (e.g. The Odds API, which has a free tier), a fixtures and results API (e.g.
football-data.org), and Polymarket's public market data. **It's a journal, not a sportsbook:** no deposits
and no wagering.

### Stack

Next.js (App Router) on Vercel · Postgres · Vercel Cron (ingest, anchor, resolve) · AI SDK (pick
extraction) · `@mysten-incubation/memwal` · `@mysten/sui` · a tiny Move package.

### Three-week plan

| Week | Deliverables |
|---|---|
| **1** (Oct 20–26) | Data adapters (odds, Polymarket, fixtures, Tatum rates); pick logging with Mainnet receipts **from day 1**; Brier scoring |
| **2** (Oct 27–Nov 2) | Trust snapshots, blender and 🧠 chips; disagreement radar; wallet voices; Move anchor and verify page |
| **3** (Nov 3–10) | Scorecards, bias nudges, polish, blog post with the **real** 3-week trust chart, demo video |

### Demo script (2:45)

1. **0:00** Hook: "Everyone says 'I called it.' Nobody can prove it, and nobody knows who to trust."
2. **0:15** Event card: books vs Polymarket gap flagged, trust-weighted forecast, 🧠 chips.
3. **0:45** Log a pick → Walrus receipt → anchored on Sui → `/verify` page (via Tatum).
4. **1:15** Matchday 1 vs Matchday 3, side by side: the weights shifted, and each shift cites a memory.
5. **1:45** The bias nudge fires while logging a new pick.
6. **2:05** A smart-money wallet beats two pundits on "WAL vs DEEP".
7. **2:25** Wipe the local index, run `restore()`, and the trust comes back. "The app's judgment lives on Walrus."

### Risks

- **Too few resolved events in 3 weeks.** Add NBA (games every day) and weekly market questions, and start
  logging real picks on Oct 20.
- **Thin Polymarket coverage of football.** Fall back to books vs wallets vs pundits. The radar still works.
- **API rate limits.** Cache odds snapshots and keep a lock-time snapshot for each event.
- **Data API coverage of Sui tokens.** Confirm early that the rate endpoints return SUI, WAL and DEEP. If
  they don't, resolve from onchain pool or oracle state read with `sui_getObject` through Tatum.

---

## Track 2 — Smart Agents for Real Life

# 📅 Tuesday

**An onchain watchdog that lives in Telegram, and in Claude and Codex through MCP. It watches the wallets,
treasuries and contracts you care about through Tatum, and learns your escalation rules from every 👍/👎.
By week two it only wakes you for what you'd actually want to know.**

*(The name is a nod to the track copy: "anyone who wished their assistant remembered last Tuesday.")*

### The aha moment

On Day 1 it pings you 40 times. You tap 🔕 on airdrop spam and reply: *"only wake me if the treasury sends
more than $5k to an address we've never paid."*
By Day 10 you get 3 pings and one morning digest, each tagged
**🧠 because: the rule you set on Oct 24**.
Then you open Claude Code and ask *"what are my alert rules?"* It knows, because it's the same memory. You
kill the server and redeploy it on another machine, and Tuesday still knows everything.

### Why it wins

| Criterion | How Tuesday scores |
|---|---|
| Integration (30%) | Walrus Memory **is** the agent's judgment: rules, episodes, entity labels and profile. Delegate keys let a user **bring their own memory** and revoke it, and the same memory works across Telegram, Claude Code and Codex |
| Technical (30%) | A **Tatum Sui gRPC live checkpoint stream**, with JSON-RPC polling as fallback; tx enrichment; deterministic guardrails around LLM triage; structured outputs |
| Creativity (20%) | The agent learns *escalation*, not just facts. Portability across tools is shown live |
| Presentation (20%) | A measurable curve: alerts per day ↓, ping precision ↑, documented every Tuesday |

It's also the strongest candidate for **Best Walrus Memory**: the learning loop is the product itself.

### What it watches (MVP)

- **Sui wallets** (yours, a team treasury, a parent's wallet you help manage): inflows, outflows, failed
  txs, new objects (airdrop and NFT spam), staking changes.
- **Contracts you depend on:** package upgrades, caught by watching `UpgradeCap` object versions. *"The
  protocol holding your funds just upgraded its code."*
- **Prices:** thresholds and moves, via the Tatum Data API.
- *Stretch:* forwarded email receipts, GitHub or status pages, all through the same triage brain.

### Pipeline

1. **Ingest:** Tatum Sui **gRPC checkpoint stream**, filtered to watched addresses and objects. Fallback:
   `suix_queryTransactionBlocks` (From/To address) with persisted cursors.
2. **Enrich:** `sui_getTransactionBlock` (balance changes, events, object changes), `suix_getCoinMetadata`,
   Tatum rates for the USD value, `suix_resolveNameServiceNames` for names, and counterparty novelty from
   the DB.
3. **Summarize** deterministically, e.g. *"Outflow 6,200 USDC (~$6,200) from Treasury to a first-time
   address, Tue 02:13 local."*
4. **Triage:**
   - `recall(rules)` by relevance, `recall(episodes, sort: "recent")`, and `recall(profile)`;
   - an LLM with structured output returns `{ route: PING | DIGEST | SILENT, reason, citedBlobIds }`;
   - **hard floors** (e.g. any outflow above your configured max) always ping, and no learned rule can
     silence them.
5. **Deliver** to Telegram with a 🧠 reason footer and buttons: ✅ Useful · 🔕 Noise · ⏰ Snooze ·
   ✏️ Teach me.
6. **Learn:**
   - each button press becomes an episode memory;
   - free text goes through `analyze()` and becomes rules, confirmed with **Undo** (which deletes the
     memory);
   - conflicting rules lead to a clarifying question.
7. **Tuesday Review** (weekly, on Tuesdays): pings sent, suppressed and marked useful, plus new rules. It's
   posted to Telegram and saved as a memory, and it becomes the blog post's chart.

### Memory design

| Namespace | Example |
|---|---|
| `rules` | `RULE: Treasury outflow > $5,000 to a first-time counterparty → wake me, even in quiet hours (set 2026-10-24 via Telegram)` |
| `episodes` | `EVENT: 120 SUI staking reward → main wallet · verdict=noise · 2026-10-22` |
| `entities` | `0x9f…c1 = landlord · monthly rent ≈ 15M VND` |
| `profile` | `Timezone Asia/Ho_Chi_Minh · quiet hours 23:00–07:00 · one morning digest` |

**Bring your own memory:** Tuesday calls `generateDelegateKey()`, the user adds that public key as a
delegate in the Memory dashboard and pastes their account ID, and the user can revoke access at any time.
For cross-tool demos, make sure the MCP plugin and Tuesday read the same namespaces; `listNamespaces()`
helps here.

### Stack

A TypeScript worker on Node 24, on an always-on host for the gRPC stream (or Vercel Cron with JSON-RPC
polling) · grammY (Telegram) · AI SDK structured output · Postgres (watchlist, cursors, counters) ·
`@mysten-incubation/memwal`.

### Three-week plan

| Week | Deliverables |
|---|---|
| **1** | Watchlist, ingest and enrich; Telegram delivery; episodes written to Mainnet **from day 1** using your real wallets |
| **2** | Triage brain with recall and guardrails; rules learned through `analyze()` with Undo; entity labels; gRPC stream |
| **3** | Tuesday Review metrics; BYO-memory onboarding; MCP portability demo; restart demo; blog post and video |

### Demo script (2:40)

1. **0:00** Hook: "My wallet alerts were either silent or screaming."
2. **0:15** Day 1: a wall of pings. Tap 🔕, then type one rule in plain English.
3. **0:45** Day 10: 3 pings, each with 🧠 citing a rule or episode, and a hard-floor alert that cuts
   through quiet hours.
4. **1:20** A package-upgrade alert on a protocol you use, read live through Tatum Sui RPC.
5. **1:45** In Claude Code: "what are my alert rules?" It recalls them. Add one rule there, and Telegram
   obeys it.
6. **2:10** Kill the worker and redeploy it on a fresh machine (`restore()`). Same judgment.
7. **2:25** Tuesday Review chart: precision 31% → 86%.

### Risks

- **The LLM silences something critical.** Hard floors plus a "never silence" rule class, with unit tests.
- **Relayer latency.** Never block triage on `remember`; write in the background through a retry queue.
- **Privacy.** The managed relayer sees plaintext, so store labels rather than secrets. Mention
  `MemWalManual` for client-side encryption.
- **gRPC complexity.** Ship JSON-RPC polling first and upgrade in week 2.

---

## Track 3 — Consumer Finance Apps

# 🧾 Tab

**Splitwise that settles itself. Log group expenses by chat or receipt photo in any currency, Tab learns
how your group actually splits things, and one tap settles up in digital dollars on Sui. No wallet, no gas,
no crypto words.**

### The aha moment

A trip to Bangkok. *"Dinner 2,400 baht, Lan didn't drink."* The first time, you fix the split by hand. The
third time, Tab excludes Lan from the alcohol automatically:
**🧠 learned from 2 corrections**.
At the end of the trip: *"Huy owes you ฿1,150 (≈ $34.20)."* Huy taps **Pay** and it's done in a second.
Or Huy withdraws USDC from an exchange straight to you, and Tab **sees it on Sui** and marks the debt
settled.

### Why it wins

| Criterion | How Tab scores |
|---|---|
| Integration (30%) | Walrus Memory stores each group's **norms** and each member's **habits**, which drive split suggestions and reminder timing. Tatum Data API locks the FX rate at expense time, and Tatum Sui RPC executes, confirms and **auto-detects** settlements |
| Technical (30%) | Debt simplification (fewest transfers), zkLogin, sponsored transactions, payment matching from onchain balance changes |
| Creativity (20%) | The app learns the group's unwritten rules. Settlement happens on its own, even when someone pays from outside the app |
| Presentation (20%) | A familiar consumer UX. "Blockchain stays invisible" is literally true |

### MVP features

1. **Sign in with Google**, which creates a zkLogin Sui address (invisible). The app shows the local
   currency only.
2. **Groups:** trip, house, couple.
3. **Add an expense** in natural language or with a receipt photo (AI SDK with vision) → structured
   expense. The currency is detected and the **rate is locked via Tatum Data API**.
4. **Smart split:**
   - `recall(group norms)` produces a suggestion with 🧠 chips, which you accept or edit;
   - an edit becomes a norm candidate, promoted after 2 consistent corrections (or right away if you say
     "always").
5. **Balances and simplify debts.**
6. **Settle up:** a USDC transfer on Sui with sponsored gas, built with `@mysten/sui`, then dry-run,
   executed and confirmed **through Tatum Sui RPC**.
7. **External payment detection:** watch creditors' addresses for USDC inflows and match them by sender and
   amount.
8. **Group Memory page:** everything Tab has learned, editable or deletable by any member. Transparency
   builds trust.
9. **Ask Tab:** *"Who paid for the Da Lat hotel?"* or *"How much did we spend on food?"* answered from
   recalled ledger receipts plus DB totals.

### Memory design

| Namespace | Example |
|---|---|
| `group:<id>:norms` | `NORM: Lan doesn't drink, so exclude her from alcohol items (learned from 2 corrections, 2026-10-24)` · `NORM: Rent split Minh 40% / Huy 30% / Lan 30% (room size)` · `NORM: Round shares to nearest 10,000 VND` |
| `group:<id>:ledger` | `EXPENSE 2026-10-22: Minh paid 1,200,000 VND (≈ $45.60 at the Tatum rate) for dinner; split Minh/Huy; Lan excluded (no alcohol)` |
| `user:<id>` | `Home currency VND · prefers Sunday-evening reminders · usually settles around the 25th (payday)` |

The app runs one Walrus Memory account with namespaces per group and per user (see the multi-tenant
cookbook) and offers **export my memory** as a user control. Postgres stays canonical for the math.

**The learning metric:** the share of splits accepted without edits climbs (e.g. 40% → 90%), and the time
from reminder to settlement drops as reminders adapt to each member's habits.

### Tatum usage

| Tatum | Call | Why |
|---|---|---|
| Data API | `/v4/data/rate/symbol`, `/v4/data/rate/symbol/batch` (fiat↔fiat and USDC↔fiat) | Multi-currency trips, rate locked at expense time |
| Sui RPC | `suix_getBalance` (USDC coin type), `suix_getReferenceGasPrice` | Balances and fees |
| Sui RPC | `sui_dryRunTransactionBlock` → `sui_executeTransactionBlock` → `sui_getTransactionBlock` | Settle and confirm |
| Sui RPC | `suix_queryTransactionBlocks` (ToAddress) + balance changes | Auto-detect external payments |
| Sui RPC | `suix_resolveNameServiceAddress` | "Pay huy.sui" |

### Stack

Next.js on Vercel (mobile-first PWA) · Postgres · AI SDK (receipt vision) · `@mysten/sui` · zkLogin and gas
sponsorship (e.g. Mysten's Enoki, or a small app-run gas station) · `@mysten-incubation/memwal`.

### Three-week plan

| Week | Deliverables |
|---|---|
| **1** | Auth with zkLogin, groups, expenses with Tatum FX, ledger receipts in Walrus Memory on Mainnet **from day 1** |
| **2** | Smart split with norm learning and 🧠 chips; Group Memory page; simplify debts |
| **3** | Sponsored USDC settle via Tatum, external payment detection, Ask Tab, polish, blog post and video |

### Demo script (2:40)

1. **0:00** Hook: "Every group trip ends with a spreadsheet and an awkward message."
2. **0:15** Snap a receipt in baht → Tab converts at the locked rate and suggests a split with Lan already
   excluded (🧠).
3. **0:50** Group Memory: what Tab learned and how. Edit one norm live and watch the next suggestion change.
4. **1:20** Settle up: one tap, no wallet popup, confirmed on Sui through Tatum.
5. **1:50** Huy pays from an exchange instead, and Tab detects it onchain and closes the debt.
6. **2:15** "Ask Tab: who paid for the hotel?", then the acceptance-rate chart.

### Risks

- **On- and off-ramps** are out of scope. Demo with about $1 of USDC on mainnet.
- **zkLogin and sponsorship setup time.** Use a managed service and wire it in week 1.
- **Receipt parsing errors.** Always confirm before saving.
- **Privacy.** Store summaries, not raw receipt images, in memory.
- **Custody.** zkLogin is non-custodial, and the app never holds funds.

---

## Which one to build?

You can make **only one submission per person**, so choose one.

| | Called It (T1) | **Tuesday (T2)** | Tab (T3) |
|---|---|---|---|
| External dependencies | High (odds, results, Polymarket) | **Low** (Tatum, MemWal, Telegram, LLM) | Medium (zkLogin, sponsorship) |
| Expected competition | Lowest | Highest (agents are popular) | Medium (Splitwise clones) |
| Depth of Tatum Sui RPC use | High | **High** (gRPC stream) | High |
| Fit for Best Walrus Memory | Strong | **Strongest** (portable judgment) | Strong |
| Risk of running out of time | Highest | **Lowest** | Medium |

**Recommendation: build Tuesday if you're solo.** It has the fewest moving parts, every judging criterion
lines up with the core loop, and the cross-tool portability demo is exactly the story the Walrus team
tells about its own product. That gives it a real shot at both 1st in the track and Best Walrus Memory.
If you have a team of 2–3 and are comfortable with sports data, **Called It** sits in the least crowded
track.

---

## Playbook for whichever idea you pick

1. **Start writing real memories on Oct 20.** A believable learning curve needs weeks of real data, and you
   can't fake it on Nov 9.
2. **Put memory on screen.** Every decision gets a 🧠 chip that quotes the memory and links its `blob_id`.
3. **Show before and after:** the same input on Day 1 and on Day 14.
4. **Wipe and restore:** delete the local index or DB cache, run `restore()`, and the app is still smart.
   This proves the memory lives on Walrus.
5. **Use Mainnet** (`relayer.memory.walrus.xyz`). Show the memory count with `listMemories()`; you'll be
   well past 10.
6. **Make Tatum Sui RPC obvious in code:** a typed `tatum/sui.ts` client with retries and rate limiting,
   gRPC where possible, and a section about it in the README.
7. **Keep the repo clean:** an architecture diagram, `.env.example`, one-command dev setup, unit tests for
   the scoring, triage or split logic, and no secrets.
8. **Blog post outline:** the problem → how it works → Tatum and Walrus integration → **"How it learned"**
   (metric chart plus 3 real memories quoted) → what's next.
9. **Demo video:** 2–3 minutes, a hook in the first 10 seconds, and the before/after moment by 1:30.
10. **Post on X and LinkedIn** tagging @Tatum_io and @WalrusFoundation for bonus points.
11. **Watch Discord** for the Mystery Bounty ($500), and confirm the form fields (Account ID,
    MEMWAL_AGENT_ID) with the organizers.
12. **Tatum AI Builder:** only go for that prize if the product is *primarily* built there. Otherwise, use
    it at most to scaffold the UI.
