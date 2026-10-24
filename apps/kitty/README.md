# Kitty

**The group pot that saves itself.** A trip fund or house fund where nobody has to hold the money.
- Each friend signs once.
- Kitty pulls each share right after that person's payday, never more than the cap they set.
- It spends only the way the group agreed, because a Move contract holds the pot, not a friend.

Track 3 (Consumer Finance Apps). Built in the Remora monorepo on Remora's rails
([ADR-0060](../../docs/adr/0060-build-receipts-and-kitty.md)); the design is
[ADR-0062](../../docs/adr/0062-kitty-pot-design.md) and the idea is in
[docs/ideas](../../docs/ideas/tracks-1-and-3.md).

- **Status:** U11. Runs locally; money and Move on testnet, memory on the mainnet relayer.
- **Owner:** Uy (U11). Entering it as a submission isn't decided (ADR-0060).

## How it works
1. **Join with one signature.** One PTB creates a native app-bound allowance (`allowance::propose_for_app<Balance<USDC>, KITTY>` → `pot::join`):
   - its spender is the pot's keeper;
   - its rate limit is the member's cap per window, and it expires at the deadline;
   - **the money stays in the member's own address balance until a pull.**

   Gas is sponsored, so members hold no SUI.
2. **Pulls.**
   - The keeper reads the member's address balance first (Tatum gRPC `GetBalance`).
   - If it covers the share, the keeper pulls through `pot::contribute`, and Sui enforces the cap, the
     expiry and the spender.
   - **If it doesn't, no transaction is sent** (no overdraft, no fee), and a memory records the skip.
3. **Paydays.**
   - One `SubscribeCheckpoints` stream, filtered to the members (ADR-0058), sees money arriving.
   - That's a payday memory, and the member's next pull follows right after it, with a reason that
     cites the memory's blob.
4. **Amounts adapt.** A pull is the fair share of what's left over the windows left. A member behind
   plan gets a catch-up, never above their cap.
5. **Spending.**
   - `propose` → `approve` → `execute` at quorum. Approvals count only active members.
   - After three quick spends of one kind, Kitty suggests an auto-ok cap. The group votes it like any
     proposal, and `spend_auto` works only inside it.
6. **Leave and close.**
   - Leaving revokes the allowance, so no more pulls; what you put in stays.
   - Closing (by vote, or by anyone after the deadline) refunds pro rata.

## Tatum (gRPC only, ADR-0021)
| Call | Where | Why |
|---|---|---|
| `GetBalance` | `src/keeper.ts` (`readFunds`) | Check the member's address balance before a pull |
| `SubscribeCheckpoints` (filtered, ≤10 addresses) | `src/watcher.ts` | Paydays: USDC arriving at a member |
| `GetCheckpoint` | `src/watcher.ts` | Backfill a short gap after a dropped stream (not after a re-subscribe) |
| `SimulateTransaction` · `ExecuteTransaction` · `GetTransaction` | `src/chain.ts` | Build (the SDK's resolve), send sponsored, wait |
| `GetObject` | `src/chain.ts` (`readPot`) | The pot's balance, totals and auto-ok cap |
| `ListCoins` · `GetReferenceGasPrice` | `src/chain.ts` | Gas data for a transaction sent without the dry run |

## Memory (operator account, mainnet relayer)
| Namespace | Example |
|---|---|
| `kitty:pot:<id>:members` | `SKIP member=… (Chi) …: balance $0.05 < share $0.23, so no transaction and no fee; next pull waits for an inflow (payday)` · `PAYDAY member=… (Chi) received $0.50 …` · `PULLED … $0.23 right after Chi's payday … (memory <blob>)` |
| `kitty:pot:<id>:norms` | `APPROVED proposal=2 category=food amount=$0.03 within 0 min by 2 members` · `SUGGEST auto-ok up to $0.05 …` · `RULE auto-ok cap is now $0.05, voted by 2 members` |

## Run it
```bash
cd apps/kitty
bun scripts/setup-testnet.ts                     # once: keeper + 3 test members into ../../.env
npx drizzle-kit push                             # its own `kitty` schema, local DB only
KITTY_WORKER=on bun --env-file=../../.env src/main.ts   # http://localhost:8821
# the bot: KITTY_BOT=on, only while no other poller uses TELEGRAM_BOT_TOKEN
```
- **Publish** (testnet, already done): `bun --env-file=../../.env scripts/publish.ts`.
- **Exit:** `bun --env-file=../../.env scripts/exit.ts`. It runs the keeper, the stream and the web in
  one process.
  - `exit.ts resume <pot> <step>` re-runs only a failed step.
  - `exit.ts overcap` and `exit.ts aborts` send the refusals as committed transactions.

## API
| Method | Path | |
|---|---|---|
| `POST` | `/api/pots` | `{ creator, name, goalUsd, deadline, quorum, autoOkUsd, windowMinutes }` |
| `POST` | `/api/pots/:id/join` | `{ member, name, capUsd }`: a test member's one signature |
| `POST` | `/api/pots/:id/proposals` | `spend` / `auto_cap` / `close` |
| `POST` | `/api/pots/:id/proposals/:seq/approve` | `{ member, execute }`: the approval that reaches quorum can execute too |
| `POST` | `/api/pots/:id/spend-auto` · `/leave` | Inside the auto-ok cap; leave (revoke) |
| `GET` | `/api/pots/:id` · `/memories` | The pot (mirror + onchain) and what Kitty learned |
