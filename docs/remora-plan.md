# Remora — Build Plan (Track 2, full product)

> **Scope:** [remora-features.md](remora-features.md) (132 features) · **Reuse:**
> [reuse-from-hippo.md](reuse-from-hippo.md) · **Design:**
> [remora-spec.md](remora-spec.md) · **Rules:** [event-rules.md](event-rules.md) · **APIs:**
> [tech-reference.md](tech-reference.md)
> **Deadline:** Nov 10, 2026, 17:00 UTC (midnight Vietnam time). **Target submission: Nov 9.**

**Rules of the build:**

1. **Write product code only from Oct 20.** Oct 18–19 is for accounts, keys and reading. On Oct 20 the
   **first commit imports hippo's shared libraries** as clearly labeled prior work (see
   [reuse-from-hippo.md §1](reuse-from-hippo.md#1-rules-for-reuse-hackathon-compliance)).
2. **Each wave ends with the whole product working end to end on mainnet.** Never start a wave on top of
   a broken one.
3. **The demo path is sacred.** It has to keep working at every merge:
   - create remora → Scout buys → Sentinel pings → handoff;
   - the injected payment aborts;
   - rotate the key;
   - inspector + Proof of Learning;
   - recall from Claude Code.
4. **Anything unfinished by Nov 6 ships as design** in the README roadmap, and the demo shows only what
   works.
5. **Two people, five workstreams:** Uy Le (Sui, Walrus Memory, Move, backend, deploy, launch) and Huấn (UI/UX, E2E),
   with infra and UI as a flex pool;
   see [team-split.md](team-split.md) for
   ownership, contracts and agent rules. The workstreams are WS1–WS5 (see
   [remora-features.md §3](remora-features.md#3-workstreams-for-parallel-claude-code-sessions--git-worktrees)).
   Run each as its own Claude Code session in its own git worktree, merging daily.

---

## Week 0 — Prep (Sat Oct 18 – Sun Oct 19)

**Accounts & keys:**

- [ ] **Tatum:** account and API key; note the **Tatum ID**.
- [ ] **Walrus Memory:** a mainnet account plus a delegate key. Note the **Account ID** and
      **MEMWAL_AGENT_ID**.
- [ ] **Enoki:** account for zkLogin, SuiNS subnames and the Seal mainnet key (for W4 private
      namespaces).
- [ ] **Telegram:** bot token (BotFather), Mini App enabled, an admin chat for alerts.
- [ ] **Infra:** AI Gateway key, Postgres (Neon), a **Railway** project for the backend (one
      environment, `main`), a **Vercel** project for `apps/web`, error tracking,
      KMS / secret store for the master key.
- [ ] **SuiNS:** a parent domain for subnames and Walrus Sites (e.g. `remora.sui`, if available).

**Funds:**

- [ ] Owner wallet: about $30 USDC, moved into the **address balance**.
- [ ] Sponsor wallet: SUI for gas.
- [ ] WAL for the Walrus Sites deploy.
- [ ] Playground pool: about $20 USDC.

**Reading:**

- [ ] [Using Allowances](https://docs.sui.io/onchain-finance/allowances/using-allowances) + FAQ
- [ ] [Address balances](https://docs.sui.io/onchain-finance/asset-custody/address-balances)
- [ ] the [x402 Sui spec](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_sui.md)
- [ ] MemWal guides: account SDK, manage, import, plus hippo's `docs/MEMWAL-NOTES.md` and `docs/SPIKES.md`
      (in `reference/hippo`)

**Decisions:**

- [ ] Demo watch targets: your wallets, one public treasury, one protocol `UpgradeCap`.
- [ ] Shared contracts to freeze on Oct 20: the Disc ABI, Wake schema, `remora.yaml`, tool registry, DB
      schema.

---

## W1 — Rails (Mon Oct 20 – Sat Oct 25)

| Day | WS1 Chain | WS2 Runtime | WS3 Memory & Wake | WS4 Surfaces | WS5 Platform & Ops |
|---|---|---|---|---|---|
| Mon 20 | **Labeled hippo import** (toolchain, `packages/memory`, `packages/db`, channels, web shell; `@hippo` → `@remora`), `packages/schema` frozen, `packages/chain` (Tatum) | Job queue skeleton (D2) on the ported server | `diagnose` green; MemWal smoke test: **≥10 mainnet memories**; namespace schema (F1) | Ported Vite shell + wallet sign-in (A1) | Logging, tracing, error tracking (K1) |
| Tue 21 | **Spike (go/no-go):** address-balance deposit → app-bound allowance → stub `DISC` spend, sponsored, via Tatum. Measure settlement delay. Find the address-balance read | Durable retries, idempotency, dead-letter (D2) | Wake schema v1 (G1) | Funds view + **Detect funds** button (A4 UI) | CI, Move test runner |
| Wed 22 | `remora::disc` + permit guards (E1, I6) | Signer + envelope-encrypted keys (B4) | `packages/memory` (namespaces, writes) | Detect / move / withdraw flows (A4) | — |
| Thu 23 | Move tests green → **publish to mainnet** | Gas sponsor service (D8) | Intent hash → `Paid.intent` (G2) | — | — |
| Fri 24 | `disc-sdk` (E2): builders, revoke + reissue, `disc.fetch` | — | — | — | — |
| Sat 25 | Facilitator (E3): verify via dry-run, settle via execute | Sentinel watcher on your real wallets (data starts accumulating) | — | — | `sui-risk` merchant (E9) |

**Exit W1:** a real x402 call is paid on mainnet from a remora key through its Disc. It's sponsored, the
funds come from the owner's address balance, and `Paid.intent` matches the stored Wake.

## W2 — Core product (Sun Oct 26 – Sat Nov 1)

| Workstream | Features |
|---|---|
| WS1 Chain | One-PTB creation (B3), rotate (B9), over-limit approval tx (E4) |
| WS2 Runtime | Triggers: message, cron, chain (D1). Turn engine (D3, adapted from hippo's agent loop), tools (D4), model routing and caps (D9). **Scout** (C1), **Sentinel** (C2). Content isolation (I1), **Sonar** (I2), rate limits (I4), scrubber (I5) |
| WS3 Memory & Wake | Learning loops (F2), **inspector** (F3), index check (F6), scrubber (F11a), `remora verify` (G3), feedback everywhere (N19) |
| WS4 Surfaces | Memory account detect/create (A3), **zkLogin** (A2, ported), **Telegram linking** (A5), onboarding wizard (A6), settings (A7), create from template (B1), edit (B6), budget change (B7), pause and retire (B8), **Telegram bot** (H1), **dashboard** (H4), notification policy (H5). UX: **activity feed** (N1), **approval inbox** (N2), **"Why?" on every message** (N4), budget meter (N5), **human errors and pending states** (N6), **panic button** (N10), human schedules (N12), **first-run instant win** (N13) |
| WS5 Platform & Ops | `odds` + `brief` merchants (E9) |

**Exit W2:**

- a new user goes from sign-in to their first remora in under 3 minutes;
- Scout buys and answers with Wakes;
- Sentinel learns a rule from free text;
- the injected payment is stopped by Sonar *and*, when forced, by the Disc;
- **start daily dogfooding** (Nov 1).

## W3 — Full product (Sun Nov 2 – Thu Nov 6)

| Workstream | Features |
|---|---|
| WS1 Chain | Public facilitator (E13), `Anchored` events for Merkle batches (G4), **`remora::hatchery` module** (M6) |
| WS2 Runtime | Price and webhook triggers (D1b), handoffs (D5), group chat (D6), heartbeat (D7). **Errand** (C3), **Subscriptions Keeper** (C4), **Treasurer** (C5), **Daily Brief** (C6). Red-team suite (I3). **Template safety review** (M7), **shadow mode** (N3), **chat-first management** (N9) |
| WS3 Memory & Wake | Hide / correct / forget all (F4), expiry display (F5), import (F7), export (F8), **MCP mapping** (F9), weekly review (F10), hygiene (F11b), **Proof of Learning** (G5), public proof links (G6) |
| WS4 Surfaces | Account exit (A8), create from a plain-language job (B2), **SuiNS identity** (B5), `remora.yaml` (B10), voice and images (H2), **Mini App** (H3), **Walrus Sites landing/docs** (H6), **playground** (H7), **Discord + Slack** (H8, ported), i18n EN/VI (H9). **Hatchery:** share (M1), publish to Walrus (M3), gallery (M4), **one-click hatch** (M5), badge (M12). UX: ⌘K search (N7), health badges (N8), config history (N11), guide (N14), cost card (N15), personalization (N16), accessibility (N18), status page (N20) |
| WS5 Platform & Ops | Budget proposals (E5), spend analytics (E6), **Reef** (E7), merchant kit (E8), npm packages (J1), docs site (J4), health dashboard (K2), admin alerts (K3), cost tracking (K4), rebuild from truth (K5), **learning-metrics pipeline** (L1), README + threat model (L2, I7) |

**Exit W3 (Nov 6):** every W1–W3 feature passes its definition of done, and the full demo path runs
twice in a row on mainnet without intervention.

## W4 — Launch + expansion (Fri Nov 7 – Sun Nov 9)

| Day | Launch track (priority) | Expansion track (in parallel, if green) |
|---|---|---|
| Fri 7 | **Record the demo video**; draft the blog post | Starter memory packs (M2), template updates (M8), Portfolio Guard (C7) |
| Sat 8 | **Publish** the blog, X thread and LinkedIn post (tag @Tatum_io, @WalrusFoundation) | **Public remora** (M9), author analytics (M10), ratings (M11), Inbox (C8), Splitter (C9), MCP connections (D10), Reef reputation (E10) |
| Sun 9 | **Submit the form**; final README roadmap (L2) | Remora-as-merchant (E11), MPP adapter (E12), private namespaces (F12), capsules (F13), auditor access (G7), WhatsApp (H8), shared remoras (N17), CLI (J2), outbound API (J3) |
| Mon 10 | Buffer only, no merges after 12:00 UTC | — |

---

## Demo script (2:45)

1. **0:00** Hook: "Grok Bot, Dots and Muse can do your errands. None of them let you see their memory,
   and none of them can be trusted with a wallet."
2. **0:15** Onboarding: zkLogin → **Detect funds** moves $5 of coins into the address balance → link
   Telegram → create **Scout** (*$20/month, $0.50 per payment, Reef payees*) with one signature. Show its
   SuiNS name.
3. **0:40** Ask Scout in Telegram. It buys from 2 Reef services and answers with Wakes. In the inspector,
   the source scores update.
4. **1:05** **Sentinel** pings about an airdrop and hands it to Scout, which buys a `sui-risk` check:
   "likely scam".
5. **1:20** A poisoned page tells Scout to pay 50 USDC to `0xbad…`. **Sonar blocks it.** Force it anyway,
   and **the Disc aborts onchain.** *"The limit lives in the contract, not in the prompt."*
6. **1:40** "Leaked key" → rotate from the Mini App in one tap.
7. **1:55** **Proof of Learning:** the same event on Day 1 and Day 14, and the memory that changed the
   decision, with `remora verify` ✓.
8. **2:15** In Claude Code, *"what did my remoras learn this week?"*. Same memory, different tool.
9. **2:30** "Try it yourself": **hatch Scout from the Hatchery** with one click (consent screen, $1
   playground Disc, shadow mode), hosted on Walrus Sites.
10. **2:40** Close: *"It goes wherever you go. It cleans up after you. It never takes the wheel."*

---

## Blog post outline: "Rails Before Robots, Part 2: I built the missing row"

1. **Recap.** The audit's scorecard: spending limits were only half green, with Allowances live and no
   agent product using them.
2. **Remora in 30 seconds.** The metaphor, plus the Disc, Wake, Sonar and Reef.
3. **How it uses Walrus:**
   - memory namespaces, inspector, renewal;
   - MCP portability and import/export;
   - Wakes;
   - Walrus Sites.
4. **How it uses Tatum:** the gRPC stream, dry-run and execute, the public facilitator, the Data API.
5. **Address balances + app-bound Allowances in practice.** A code snippet, plus the gotchas:
   - coins vs address balance;
   - settlement delay;
   - no in-place update;
   - no events;
   - gas.
6. **How it learned over time** (required):
   - charts for Sentinel pings/day and precision, and Scout's $ per useful answer;
   - **3 real memories** alongside the decisions they changed;
   - Proof of Learning screenshots.
7. **The red-team results:** N attacks, 0 overspends, with the abort transaction on an explorer.
8. **What's next:** the remaining roadmap, Agent Pass compatibility, tunnels.

---

## How it scores

| Criterion | Evidence |
|---|---|
| Integration (30%) | Walrus Memory drives every decision, with inspector, renewal, import/export, MCP and Wakes. Walrus Sites hosts the frontend. Tatum gRPC triggers, and Tatum JSON-RPC verifies and settles every payment. Tatum also powers the Data API values and the public facilitator |
| Technical (30%) | Address balances + app-bound Allowances + the Disc Move module with tests, the x402 facilitator, sponsored gas, envelope-encrypted keys, Sonar, a red-team suite, `remora verify`, rebuild from truth |
| Creativity (20%) | Always-on agents with **owned memory + contract-level budgets + verifiable receipts**, plus Reef, a service economy for agents |
| Presentation (20%) | The playground judges can use, the abort moment, Proof of Learning, a blog that's a sequel to the published audit |
| Best Walrus Memory ($500) | Memory visibly reallocates Scout's budget and silences Sentinel. Every memory can be inspected, renewed, exported, and is linked to the decisions it caused |
| Bonus | X and LinkedIn to an existing audience |

---

## Risks

| Risk | Mitigation |
|---|---|
| **132 features in 22 days** | About 40 get a head start from hippo; parallel workstreams; contracts frozen on day 1; wave exits enforced; anything unfinished ships as roadmap design |
| Judges see reused hippo code as recycled | A labeled import commit, a README "Built on prior work" section, and the pitch led by what's new (money rails, autonomy, Wake, Tatum, Hatchery) |
| Malicious shared templates | Payees only from Reef, consent screen, Sonar scan, shadow mode, Disc limits (M5, M7) |
| Allowances and address balances are new (protocol v138) | Oct 21 spike; fallback to a `Coin` escrow with the same Disc policy |
| Address-balance settlement delay | Measure it in the spike; the UI shows a *settling* state; don't spend right after a deposit in the demo |
| Address-balance reads through Tatum unclear | Spike item. Fallback: compute the split from `suix_getCoins` + the total balance |
| No per-memory delete in Walrus Memory | Settled: hide (local filter), correct (supersede) and forget all (namespace index). The UI states plainly that blobs persist until they expire |
| Enoki access (zkLogin, subnames, Seal) delayed | Request it in week 0. Wallet sign-in and plain addresses cover W1–W2 |
| Playground abuse | $1 Disc, rate limits, CAPTCHA-free throttling by session, 24-hour retirement, a capped pool |
| Sponsor wallet drained | Per-remora gas budgets, admin alerts, a global daily cap |
| Relayer sees plaintext | Scrubber, no secrets in memory; private namespaces (F12) on the roadmap |
| Mainnet or RPC hiccups during the demo | Retries and idempotency; record on Nov 7 with a backup take |
| Thin learning data | Sentinel on real wallets from Oct 25; daily dogfooding from Nov 1 |

---

## Submission checklist

- [ ] Walrus Memory writing on **mainnet**, ≥10 memories (show the count from `listMemories`)
- [ ] Tatum Sui RPC in the core path (gRPC stream + dry-run/execute + facilitator), documented in the
      README
- [ ] Public repo, Apache-2.0/MIT, `.env.example`, one-command dev, Move tests, evals and CI
- [ ] README section **"Built on prior work"** (hippo, commit `66fb33a`), listing what was reused and what's new
- [ ] Working demo URL + playground + Walrus Sites URL + a 2–3 minute video
- [ ] Blog post published, including **how it learned over time**
- [ ] Form fields: email, Discord, LinkedIn, Tatum ID, SUI address, Account ID, MEMWAL_AGENT_ID,
      description, video, repo, feedback on Walrus and on Tatum AI Builder
- [ ] X + LinkedIn posts tagging @Tatum_io and @WalrusFoundation
- [ ] Watch Discord for the Mystery Bounty
