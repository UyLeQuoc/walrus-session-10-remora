# Goal U11: Receipts (Track 1) and Kitty (Track 3), built overnight on Remora's rails

- **Owner:** Uy's agent, **unattended overnight**. Uy is asleep: don't stop to ask. Decide, write the
  ADR, and continue. Anything that truly needs Uy goes on the morning list.
- **Runs in:** the main checkout, on `main` (ADR-0022). It doesn't wait on U9.
- **Decision:** [ADR-0060](../adr/0060-build-receipts-and-kitty.md). The design is in
  [ideas/tracks-1-and-3.md](../ideas/tracks-1-and-3.md).
- **Network:** money and Move on testnet. Memory on the mainnet relayer with the operator account,
  namespaces `receipts:*` and `kitty:*`.
- **Env:** the current `.env`, as is (ADR-0060).

**Goal:** by morning, two working apps in this monorepo. Each passes its exit on testnet, and each can
move to its own repo later.
- **Receipts:** a group-chat pick'em. Picks are anchored on Sui, scored against the books and markets,
  and Receipts learns who to trust.
- **Kitty:** a group pot. It pulls each share through native app-bound Allowances, after payday, and
  spends by group rules.

The order is free. **Receipts first is recommended:** it moves no money, and its live ingest gathers real
data while Kitty is built.

## Before you start
- **Read:**
  - [the ideas doc](../ideas/tracks-1-and-3.md);
  - ADR-0003, 0020, 0021, 0024, 0026, 0055, 0058, 0060;
  - [tech-reference §1.11](../tech-reference.md) (MemWal quirks);
  - `packages/move/remora/sources/disc.move` (`issue`, `pay`, permits, versions);
  - `packages/disc-sdk` (allowance builders);
  - `apps/server/src/channels` (Telegram);
  - `apps/server/src/triggers/watch.ts` (filtered streams);
  - `apps/server/src/runtime/verify.ts`;
  - `apps/facilitator/src/gas-pool.ts`.
- **Memory health.** Run `cd apps/server && bun run diagnose` and check the memory recall item before
  any memory step. If the relayer is down, build and test the rest, and retry memory later.
- **Testnet SUI is short:** about 0.32 SUI across the burner, the sponsor and the spike owner, and the
  faucet API refuses this machine.
  - Send the publishes and the exits from whichever key has SUI.
  - Leave the burner and the sponsor ≥0.05 SUI each, for Remora's e2e.
  - If SUI runs out: stop the onchain steps, finish everything else, and put "testnet SUI" at the top of
    the morning list.

## Layout and rules for both apps
- **Folders:**
  - `apps/receipts`: API, worker, bot and web;
  - `apps/kitty`: the same;
  - `packages/move/receipts`;
  - `packages/move/kitty`.
- **Stack:** follow Remora's: Hono plus drizzle on the server, Vite plus React plus Tailwind plus TanStack
  Query on the web, grammY for the bot, vitest or `bun test` like the neighbouring code.
- **Imports:** workspace packages only. Copy what you need from `apps/*`, with a source comment. Don't
  edit `apps/server`, `apps/web`, `apps/facilitator`, `packages/schema` or `e2e/`.
- **Database:** each app uses its own Postgres schema in the local dev database (`localhost:5434`).
  `drizzle-kit push` runs only against that database.
- **Ports:**
  - Receipts: API 8811, web 5181;
  - Kitty: API 8821, web 5182;
  - never 8787/5173. Remora's test ports are 8797–8799.
- **Gas:** sponsored by `SPONSOR_PRIVATE_KEY_TESTNET` (two signatures, both keys local). Members never
  need SUI.
- **Keys:** new keys (Kitty's keeper, its test members) are generated into `.env`. Add the names to
  `.env.example`. Never commit or print values.
- **Install:** with the pinned Bun (`npx -y bun@1.3.14 install`), because local Bun 1.3.9 rewrites the
  lockfile (ADR-0057). Prefer deps the repo already has, since the OSV scanner blocks vulnerable ones.
- **Tatum:** gRPC only, through `@remora/chain`'s paced transport.
  - Every stream is filtered (≤10 addresses, ADR-0058), off by default (`RECEIPTS_WORKER`,
    `KITTY_WORKER`), and stopped at the end.
  - Log `tatumUsage()`.
- **Memory:**
  - writes are batched; the relayer allows ~1000 weighted requests an hour, shared with Remora;
  - every number the product shows next to 🧠 links the memory behind it;
  - Postgres does the math, and memory holds the conclusions the product acts on.
- **Third-party text is untrusted** (pundit pages, market titles): wrap it like `packages/memory`'s
  `untrusted`, and run it past Sonar.
- **Telegram:** handlers tested with a fake Bot API.
  - A live check may use `TELEGRAM_BOT_TOKEN`, but only while no other poller runs, one app at a time.
  - If Telegram Web is still logged in (claude-in-chrome), DM the bot. Otherwise record "Telegram
    unverified".
- **Docs:** each app gets a README: what it does, how to run it, every Tatum call, the memory design and
  the exit.

## Receipts (Track 1)
1. **RC0, sources spike (≤1 h, keyless only).** Record in an ADR what works.
   - ESPN's public scoreboard JSON for NBA and EPL: fixtures, results and the listed book line.
   - The Polymarket Gamma API and CLOB price history: NBA games and the Nov 3 midterms.
   - Kalshi's public market data.
   - A Pyth or DeepBook price object for Sui market questions, read through Tatum gRPC `GetObject`.

   A source that needs a key is skipped.
2. **RC1, Move PR: `receipts::anchor`.**
   - `anchor(root, count, clock)` checks that the root is 32 bytes and emits
     `Anchored { root, count, ts_ms, sender }`.
   - It has a version field and `sui move test`, and CI runs the new package.
   - Merge when green, publish on testnet, and put the id in `apps/receipts/src/deployments.ts`.
3. **RC2, backend:**
   - groups, members, events, voices, picks and scores;
   - **a pick after lock is refused.** Lock is the event's start from the source, in server time;
   - picks go to memory (`receipts:group:<id>:picks`);
   - **anchor job:** every 10 minutes (1 in tests), the Merkle root of new picks is sent as a sponsored
     testnet transaction;
   - **`/verify/:pick`:** recomputes the leaf and the proof, fetches the transaction through Tatum gRPC,
     and checks that the root matches and that `ts_ms` is before lock. A tampered pick fails.
4. **RC3, scoring and learning:**
   - Brier score and calibration per (voice × league × market type), with shrinkage;
   - each resolution batch writes a trust snapshot memory and a radar memory;
   - **Receipts' own call takes its weights from the trust snapshots recalled from memory** and cites
     their ids;
   - nudges come from per-member insight memories, written when a pattern holds (n ≥ 5);
   - pundit picks: pasted text is extracted by `LLM_SMALL_MODEL`, untrusted.
   - Stretch: wallet voices through one filtered stream.
5. **RC4, bot:** `/pick`, `/board`, `/call`, `/me` and `/verify`, in groups and in DMs.
6. **RC5, web:**
   - the board: books, Polymarket, Kalshi, the group and Receipts' call with 🧠 chips;
   - a pick form, the leaderboard, a receipt with its verify page;
   - **Learning:** Receipts' call vs the plain average vs the books.

   It works at phone width.
7. **RC6, real data:**
   - backfill the NBA season so far (since Oct 20) and recent EPL with the real lines and prices, labelled
     "backfill";
   - load the midterm markets;
   - start live ingest locally, so tonight's games resolve.
   - **No invented member picks.** Test members are labelled test.

**Receipts exit (testnet, a script or Playwright under `apps/receipts/e2e`):**
1. Two test members pick an upcoming real game through the API and the web. A pick on a locked event is
   refused.
2. The anchor transaction lands. `/verify` passes for a pick and fails for a tampered one.
3. A finished real game resolves:
   - the scores update;
   - a trust snapshot is written on mainnet (counted with `listMemories`);
   - Receipts' call changes and cites the memory ids.
4. A nudge fires for an overconfident test member.
5. The Learning page shows the backfill curve, with N games.

## Kitty (Track 3)
1. **KT1, Move PR: `kitty::pot`** (app type `KITTY`, following the Disc's patterns).
   - `create`: a shared `Pot<C>` with:
     - name, goal and deadline;
     - quorum;
     - auto-ok cap;
     - keeper;
     - the members and what each contributed;
     - a `Balance<C>`.
   - `join`: in the same PTB as `allowance::propose_for_app<Balance<C>, KITTY>`. The spender is the
     keeper, the rate limit is the member's cap per window, and the expiry is the deadline.
   - `contribute` (keeper): `app_balance_spend` into the pot, emitting `Contributed`.
   - `propose`, `approve` and `execute` handle spends **and rule changes**. Execute aborts under quorum.
   - `spend_auto` works up to the auto-ok cap and aborts above it.
   - `leave` (revoke) and `close` (pro-rata refund).
   - Every money move emits an event.

   `sui move test` covers each abort and the rounding. Merge when green, then publish on testnet.
2. **KT2, backend and keeper:**
   - schedule pulls per member;
   - **check `GetBalance` first.** A pull that can't be paid sends no transaction: record the skip and
     write a memory;
   - one filtered stream on the pot's members detects inflows, learns paydays and moves the next pull to
     after them;
   - amounts adapt to keep the goal on track;
   - suggested auto-ok rules come from fast approvals, cite memory, and need the group's vote onchain;
   - local currency comes from Tatum's Data API rate if the key allows it; otherwise a fixed rate,
     labelled;
   - the bot: approve buttons, the progress, "why".
3. **KT3, web:**
   - the pot page: progress, members with their next pull and 🧠 reason, proposals with approve;
   - joining with one signature: dapp-kit, or a labelled demo member, since there's no Enoki key;
   - "What Kitty learned".

**Kitty exit (testnet):**
1. "Da Lat trip" with 3 new test members, each funded with ≤1 testnet USDC from the spike owner. Each
   joins with one signature.
2. Two pulls land. Member C is short, so no transaction is sent and a memory is written. The spike owner
   then pays C ("payday"), the stream sees it, the pull lands, and its reason cites the memory.
3. One deliberate pull above the window's cap aborts onchain, and nothing moves.
4. "Hotel":
   - with 2 approvals, it executes and the payee is paid;
   - under quorum, `execute` aborts.
5. An auto-ok rule is suggested, then voted in.
   - A spend inside the cap passes.
   - A spend above it aborts.
6. A member leaves, and their next pull is impossible. `close` refunds pro rata, and the sums balance.
7. There are ≥10 `kitty:*` memories, and the learned page shows them.

## Finish
- **Run each exit once.** Re-run only a failed step after its fix, to save testnet SUI.
- **Record `docs/spikes/2026-10-25-u11-exit.md`:**
  - the sources that worked;
  - the package ids and digests;
  - the timings;
  - the memory counts;
  - Tatum usage per method;
  - what's verified and what isn't;
  - **the morning list for Uy:** keys to rotate, SUI, the submitters, Discord, the bots, whatever is left.
- **Update:** the ideas doc's status, the goals README, CI (both Move packages), and `.env.example`.
- **Stop** every service, stream and poller.

## Done when
- [ ] Both Move PRs are merged, and both packages are on testnet.
- [ ] Both exits passed on testnet, or each failing step names its blocker in the spike doc.
- [ ] typecheck, lint, test, `sui move test` and CI are green, and Remora's suite is untouched and green.
- [ ] The ADRs, the app READMEs and the spike doc are written, and everything is pushed to `main`.

## Never
- Mainnet money or a mainnet publish.
- A deploy.
- Committing `.env`, keys or tokens, or printing key values.
- Force-pushing.
- Ports 8787/5173.
- Editing `reference/`, Huấn's paths or branches, `packages/schema`, or Remora's apps.
- Rewriting an accepted ADR.
- An unfiltered checkpoint stream, or two pollers on one bot token.
- Invented data presented as real.
- A decision without an ADR in the same commit.
