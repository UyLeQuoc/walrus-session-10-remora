# Receipts

**The group-chat pick'em that keeps the receipts.** Friends log picks before lock, in Telegram or on the
web. Each pick is sealed on Sui in a Merkle batch, so nobody can claim "I called it" afterwards. After
the final whistle, everyone is scored against the books (DraftKings), Polymarket and Kalshi. Receipts
learns who to trust on what, and its own call cites the Walrus Memory it learned that from.

Track 1 (Markets & Sports Prediction). It's built in the Remora monorepo on Remora's rails
([ADR-0060](../../docs/adr/0060-build-receipts-and-kitty.md)). Design and sources are in
[ADR-0061](../../docs/adr/0061-receipts-sources-and-design.md); the idea is in
[docs/ideas](../../docs/ideas/tracks-1-and-3.md).

- **Status:** U11. Runs locally on testnet; memory is on the mainnet relayer.
- **Owner:** Uy (U11). Entering it as a submission isn't decided (ADR-0060).

## How it works
1. **Markets:**
   - NBA games and EPL matches from ESPN's public scoreboard;
   - the US midterms (Nov 3) from Polymarket and Kalshi.

   Every market is binary: "Will <home> win?" or "Will <yes side>?".
2. **Voices:** the books' moneyline (vig removed), Polymarket's and Kalshi's prices before lock, and each
   member's picks.
3. **Pick before lock.** `/pick Celtics 70` in the group chat, or the web form. A pick at or after the
   event's start is refused.
4. **Receipt:**
   - the leaf is `sha256("receipts/v1" ‖ canonical pick)`;
   - every 10 minutes, and right away when an event is about to lock, the Merkle root of new picks goes
     onchain through `receipts::anchor` ([packages/move/receipts](../../packages/move/receipts));
   - `/p/<pick>` and `POST /api/verify` check the proof against the transaction's `Anchored` event,
     read through Tatum gRPC, and check that it was anchored before lock.
5. **Scoring:** a Brier score per (voice × league), shrunk toward a coin flip, plus hits and calibration
   bands.
6. **Learning (Walrus Memory):**
   - after results, a **trust snapshot** per league goes to `receipts:group:<id>:trust`, and a **radar**
     memory (books vs markets when they disagreed) to `…:radar`;
   - **Receipts' own call takes its weights from the snapshot recalled from memory**, not from the
     database, and its 🧠 chips cite the blob;
   - overconfidence becomes an **insight** in `receipts:member:<id>:insights`, and the next sure pick
     recalls it as a nudge.
7. **Learning page:** a walk-forward curve. Each call uses only what was learned before it: Receipts'
   weighted call vs the plain average vs the books. The NBA season so far (Oct 20–23) is backfilled
   with real lines and real results, labelled "backfill".

## Tatum (gRPC only, ADR-0021)
| Call | Where | Why |
|---|---|---|
| `ExecuteTransaction` | `src/chain.ts` | Anchor a batch (testnet; the sponsor key pays) |
| `GetTransaction` (polled by `waitForTransaction`) | `src/chain.ts` | Show a receipt only once the node has it |
| `GetTransaction` (events) | `src/chain.ts` | `/verify`: read the `Anchored` event |
| `GetObject` | RC0 spike | Pyth SUI/USD on Sui; stale, so Sui price questions are deferred (ADR-0061) |

## Memory (operator account, mainnet relayer)
| Namespace | Example |
|---|---|
| `receipts:group:<id>:picks` | `PICK member=… event=espn:nba:401909853 "Heat at Hornets" side=no (Heat win) confidence=0.56 …` |
| `receipts:group:<id>:trust` | `TRUST snapshot league=NBA as_of=… events=28 \| polymarket n=28 brier=0.186 hits=21 w=0.34 \| …` |
| `receipts:group:<id>:radar` | `RADAR league=NBA … disagreements=4 books_closer=3 markets_closer=1` |
| `receipts:member:<id>:insights` | `INSIGHT member=… league=NBA overconfident: picks at >=80% hit 2 of 8 (average confidence 90%)` |

## Run it
```bash
# from the repo root, with the repo's .env
cd apps/receipts
npx drizzle-kit push                                   # its own `receipts` schema, local DB only
bun --env-file=../../.env scripts/backfill.ts          # NBA since Oct 20 + recent EPL, labelled backfill
RECEIPTS_WORKER=on bun --env-file=../../.env src/main.ts   # http://localhost:8811
# the bot: RECEIPTS_BOT=on, only while no other poller uses TELEGRAM_BOT_TOKEN
```
- **Publish** (testnet, already done): `bun --env-file=../../.env scripts/publish.ts`.
- **Exit:**
  - `bun --env-file=../../.env scripts/exit.ts before`, before tonight's games lock;
  - then `… exit.ts after`, once they're final.
- **Tests:** `bun run test`. The database tests skip themselves without Postgres.

## API
| Method | Path | |
|---|---|---|
| `POST` | `/api/groups` · `/api/groups/:id/members` | Create a group or a member (`test: true` labels it) |
| `GET` | `/api/groups/:id/events` | Open markets with each source's number |
| `POST` | `/api/picks` | `{ groupId, memberId, eventId, side, confidence }`. 409 `locked` after the start |
| `GET` | `/api/groups/:id/calls/:eventId` | Receipts' call, its weights, the snapshot blob, the 🧠 chips |
| `GET` / `POST` | `/api/receipts/:pick` · `/api/verify` | The portable receipt; verify it against Sui |
| `POST` | `/api/anchor` · `/api/groups/:id/learn` | Run the anchor batch or the learning pass now |
| `GET` | `/api/groups/:id/scores` · `/learning` · `/memories` | Scores, the curve, what was learned |
