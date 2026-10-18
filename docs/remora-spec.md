# Remora — Product & Technical Spec

> **Track:** Smart Agents for Real Life (our only track for now) · **Build window:** Oct 20 – Nov 10,
> 2026, 17:00 UTC · **Scope:** full product, see [remora-features.md](remora-features.md) (132
> features) · **Reuse:** [reuse-from-hippo.md](reuse-from-hippo.md) · **Schedule:** [remora-plan.md](remora-plan.md) · **APIs:**
> [tech-reference.md](tech-reference.md)

**Remora** is a set of always-on agents in the style of Grok Bot, Dots and Muse. You create one by
describing a job in plain language. It works in the background and messages you first. The difference is
what it's built on:

- **memory you can read, edit and take with you**, through Walrus Memory;
- **a budget it cannot exceed**, enforced on Sui by native Allowances and the remora's **Disc**;
- **a receipt for everything it does**: its **Wake**.

*A remora rides along with a shark or whale across the whole ocean and cleans parasites off it, but it
never steers. Each agent is a **remora**. Its onchain spending limit is its **Disc**, named after the
remora's suction disc, which holds on tight but controls nothing. Its receipts are its **Wake**.*

> **Pitch:** "It goes wherever you go. It cleans up after you. It never takes the wheel."

---

## 1. Why now: the gap

These facts come from the owner's audit *"Rails Before Robots"* (X, Oct 15, 2026) and the docs it links,
re-checked on Oct 18.

| Fact | What it means for Remora |
|---|---|
| **Native Allowances** have been live on mainnet since Oct 9 (protocol v138) as `sui::allowance`: a lifetime cap, rate limit, start and expiry, nothing locked, revocable. **App-bound** allowances route every spend through *your* Move module (`std::internal::permit<A>()`) | The Disc is the app module of an app-bound allowance. There's no escrow wallet to write |
| Allowances can't be updated in place. Windows are fixed, and periodic windows count from the first spend. **The module emits no events** | A budget change means revoke + reissue in one owner PTB. The Disc emits its own `Paid` events, and we index them through Tatum |
| **Agent Pass** exists only on stage (no docs, code or date). **Agent Payments** is testnet-only and invite-only, with a pre-funded pool, so it doesn't appear to use native Allowances | A mainnet agent-spending product doesn't exist yet. Remora is that missing row of the scorecard |
| **x402** has an official Sui `exact` scheme, but mainnet facilitators are small community builds, and Coinbase's facilitator doesn't list Sui | We ship a Tatum-backed x402 facilitator for `sui:mainnet` |
| **VAA** (Mysten + Google Cloud) is an evidence layer for agent actions, but enterprise-only and still being co-developed | Wake is a "VAA for everyone" |
| The **gasless lane** handles about 300 transfers/s network-wide, and only for simple stablecoin transfers | Allowance spends need gas, so the runtime sponsors it |
| **Walrus Memory** is on mainnet but beta (TS SDK v0.1), and the relayer sees plaintext. **Walrus Console** shows which agents use which memories | Keep secrets out of memory, and use Console as an independent view in the demo |
| Mainnet had about 15–17 hours of outages on May 28–29 | Retries, idempotent settlement and a pause switch are product features |

**Principles we borrow:**

1. *The limit lives in the contract, not in the prompt.*
2. *Settle first, then deliver.*
3. *Spending limits stop overspending; receipts show what actually happened.*
4. *Rails before robots:* everything has to be live on mainnet.

---

## 2. Positioning: where the 2026 agents fall short

| | Grok Bot (xAI, beta Aug 11) | Dots (OpenAI, Sep 29) | Muse (Meta, Sep 8) | **Remora** |
|---|---|---|---|---|
| Create from a job description | ✅ name + one main job | ✅ named dot, `@handle` | ✅ chat request | ✅ name + job + budget |
| Always on, proactive | ✅ routines on its own cloud computer | ✅ background checks, messages you first | ✅ keeps working after you close the app | ✅ schedules + **chain events (Tatum gRPC)** + messages |
| Memory | Per-bot summaries | **"Can't view, edit or delete individual dot memories"**, only reset (OpenAI FAQ, via critics) | Not described | **Every memory visible, editable and deletable; portable to Claude Code and Codex (MCP); owned by your Sui account** |
| Isolation between agents | **"Don't treat separate Bots as separate security boundaries"** | Per-dot | — | **Each remora has its own key, so its own onchain identity, memory delegation and budget, each revocable separately** |
| Spending | Approval prompts | "Money movement always comes back to you" | Stripe Link single-use cards + approvals | **Autonomous inside limits enforced by Move**; asks above them |
| Prompt injection | Flagged as a risk | Review model before actions | **"Prompt injection remains unsolved"** (Meta) | It can still happen, but **it can't exceed the contract** |
| Activity log | None built in | Inspect the cloud computer | — | **Wake: one receipt per action**, its intent hash anchored onchain |
| Lock-in | Platform | Platform | Platform; data may train models unless you opt out | Open source; memory and money live in *your* account |

**Non-goals:** browser automation, and "a cloud computer per agent." Remora competes on **ownership,
limits and receipts**.

---

## 3. What a remora is

```
Remora = {
  name, job, persona            // "Scout — buys the best data to answer my questions"
  key: Ed25519 → Sui address    // one identity per remora
  memory: MemWal delegate key   // the same key, registered as a delegate on the OWNER's Walrus Memory account
  budget: app-bound Allowance   // owner → remora, bound to DISC, with a Disc policy (payees, per-payment cap)
  triggers: messages | cron | chain events (Tatum gRPC)
  tools: read-only by default; pay() is the only money tool, and it goes through the Disc
}
```

**Prerequisites** (handled by the onboarding wizard):

- the owner has a Walrus Memory account;
- the owner's USDC is in their **address balance** (see §12.1);
- the owner's Telegram account is linked.

**Creating a remora** (B3; ported from hippo's connect flow):

1. **Register the remora key as a Walrus Memory delegate** with `add_delegate_key`, sponsored by the
   **Walrus Memory relayer** (`/sponsor`), so the owner needs no SUI. The relayer's allowlist accepts
   exactly one account call per transaction. Before activating, verify onchain that the delegate is
   registered.
2. **Create the budget:** `allowance::propose_for_app<Balance<USDC>, DISC>` + `remora::disc::issue(...)`,
   sponsored by **Remora's gas station**.

*Stretch:* both steps in one PTB sponsored by Remora's own gas station, which isn't bound by the
relayer's allowlist.

**Limit:** an account holds **at most 20 delegate keys**, so an owner can have about **18 remoras**,
leaving room for MCP clients.

Before any remora reaches autonomy, it runs in **shadow mode** (N3) for 24 hours.

**Kill switches,** each independent and onchain:

- pause the Disc;
- revoke the allowance, which stops the money;
- remove the delegate key, which stops memory access;
- rotate the remora key after a leak, with the budget intact.

**Gas:** remoras hold **no SUI**. The runtime sponsors their transactions (sponsored tx, or x402
`extra.gasStation`).

**Honest boundary:** a Walrus Memory delegate key has **account-level** access, so isolating remoras by
namespace is a convention, not a security boundary. Shared memory is what enables handoffs. Money *is*
isolated per remora, onchain.

---

## 4. MVP remoras

| Remora | Job | Triggers | Money | Learning loop (Walrus Memory) |
|---|---|---|---|---|
| **🔎 Scout** | Answers questions by **buying** data from x402 sources | Your messages, handoffs | Pays per call through its Disc ($20/month, $0.50 per payment, 3 payees) | `sources`: value per dollar for each source, so spend shifts toward sources that proved useful |
| **🛰️ Sentinel** | Watches your wallets, a treasury, and protocols you depend on (package upgrades) | **Tatum gRPC checkpoint stream**, price thresholds | None (read-only) | `remora:sentinel:rules` + `episodes`: learns escalation rules from 👍/🔕/free text, so pings drop and precision rises |
| *🧾 Errand (stretch)* | Pays people or merchants for you ("pay Huy for dinner") | Messages, cron | Disc budget, approval above the cap | `me`: payees, habits |

**Handoff (week 3):**

1. Sentinel spots an unknown token airdropped to your wallet and hands off to Scout: *"is this a scam?"*
2. Scout buys a check from the `sui-risk` merchant, which reads package age, `UpgradeCap` ownership and
   holder count from Sui via Tatum.
3. Scout answers in the same thread.

Both the memory and the budget make this visible.

---

## 5. Architecture

```
   Telegram (primary chat)         Web dashboard (Vite SPA)         Claude Code / Codex
   one bot, remoras by name        create remora · memory           Walrus Memory MCP plugin
   inline buttons                  budgets · Wake · kill switch     + packages/mcp
            │                               │                                │
            ▼                               ▼                                ▼
 ┌──────────────────────── apps/server (Hono, Node 24, always-on, Railway) ─────────────────────────┐
 │ trigger loop: message | cron | chain event  →  remora turn (AI SDK 7, structured output)         │
 │ tools: recall/remember (MemWal) · tatum.* (read) · web fetch (read) · pay() via Disc SDK         │
 │ policy check (deterministic + memory rules) → act → Wake receipt (MemWal `receipts`, blob_id)    │
 └───────┬───────────────────────────┬──────────────────────────────┬───────────────────────────────┘
         │                           │                              │
  Walrus Memory (mainnet)    Tatum Sui gRPC + JSON-RPC        apps/facilitator (x402, sui:mainnet)
  relayer.memory.walrus.xyz  stream · dry-run · execute       verify (dry-run via Tatum) · settle
                             getObject · queryEvents                │
                                     │                              ▼
                                     ▼                        apps/merchants (x402 demo APIs)
               Sui mainnet: remora::disc + sui::allowance     sui-risk · odds · brief
```

### Repo layout (pnpm monorepo)

```
packages/move/remora    Move package: disc + hatchery modules (+ Anchored events) + tests → mainnet
packages/disc-sdk       PTB builders (issue/pay/rotate/pause/reissue), funds (detect/move/withdraw), disc.fetch
packages/merchant       @remora/merchant: x402 middleware + Reef auto-listing
packages/chain          typed Tatum client (gRPC stream, JSON-RPC, Data API), retries, rate limits
packages/memory         MemWal wrapper: namespaces, scrubber, Wake, renewal, import/export, inspector helpers
packages/sonar          trusted-intent builder, policy engine, check-model client
packages/signer         envelope-encrypted remora keys, sponsor co-signing
packages/mcp            MCP server: remoras_list, remora_ask, remora_budget, wake_get
packages/schema         shared contracts: Wake JSON, remora.yaml, tool registry, DB schema
apps/server             Hono: API + channels (Telegram, Discord, Slack) + triggers, turns, tools, gas sponsor
apps/facilitator        x402 facilitator for sui:mainnet (public, rate-limited)
apps/reef               x402 service directory API (+ Walrus snapshots)
apps/merchants          demo x402 APIs: sui-risk, odds, brief
apps/web                Vite + React SPA: dashboard, Mini App, playground, Hatchery, verify pages, landing
                        → Vercel (primary, a preview per PR) + Walrus Sites mirror (SuiNS domain)
evals/                  prompt-injection red-team suite, triage/scoring evals
e2e/                    Playwright demo-path suite (main deployment + Vercel previews), burner test wallet
docs/                   these docs + architecture diagram + threat model
```

### Stack

- **The stack follows hippo** (see [reuse-from-hippo.md](reuse-from-hippo.md)):
  - Bun workspaces + Turborepo, biome, vitest;
  - `apps/server` on **Hono** in one always-on Node process on Railway, running the API, the channel
    adapters (grammY, discord.js, Bolt), the trigger loop and the turn engine;
  - Postgres (Neon) + Drizzle.

  Vercel's `eve` was considered: its documented channels are Slack and Discord, not Telegram, and it
  assumes one agent per project.
- **Models:** Claude through AI Gateway: `anthropic/claude-sonnet-5-5` for remora turns,
  `anthropic/claude-haiku-5-5` for triage and extraction.
- **Chain:** `@mysten/sui` (`Transaction`, `tx.withdrawal({ from: 'allowance' })`), with every network
  call routed through **Tatum**.
- **Web:** Vite + React 19 + Tailwind v4 + shadcn/ui, dapp-kit (Slush), Enoki zkLogin and `@mysten/suins`,
  all ported from hippo. Hosted on **Vercel** (primary, with a preview per PR), plus a **Walrus Sites**
  mirror (SPA fallback, SuiNS domain) for the landing, docs and verify pages (H6).

### Deployment

| What | Where | Notes |
|---|---|---|
| `apps/server` (API + channels + runtime) | **Railway** | **One environment, `main`**, auto-deployed after CI. **One replica**, because Telegram long-polling allows one poller per token |
| `apps/facilitator`, `apps/reef`, `apps/merchants` | **Railway**, same project | One service each. Monorepo watch paths, so a change only redeploys the services it touches |
| `apps/web` | **Vercel** | Root `apps/web`, SPA rewrites. Deploys from `main`; PR previews also call the `main` API |
| Walrus Sites mirror | `site-builder` from CI | Needs WAL + a SuiNS domain. Served at `*.wal.app` |
| Postgres | Neon `main` | Local dev uses Docker Postgres. Schema changes are additive only, pushed by CI |
| Move packages | Sui mainnet | Published manually by Uy; IDs go in `packages/schema/src/deployments.ts` |

If Railway PR environments are used for the backend, they must run with `CHANNELS=off` (or their own
bot token) and their own sponsor wallet.

---

## 6. Disc: onchain spending limits

```move
module remora::disc;

use sui::allowance::{Self, Allowance, AllowanceProposal, AllowanceWithdrawal};
use sui::balance::Balance;

public struct DISC has drop {}                  // app type A of every Disc-bound allowance

public struct Disc has key {                    // shared policy, 1:1 with an app-bound Allowance
    id: UID,
    owner: address,                             // the funder
    allowance: ID,
    payees: VecSet<address>,                    // allowed services (x402 payTo addresses)
    per_payment_cap: u64,
    paused: bool,
    version: u64,
}

public struct Paid has copy, drop { disc: ID, payee: address, amount: u64, intent: vector<u8>, ts_ms: u64 }

/// Owner PTB: allowance::propose_for_app<Balance<USDC>, DISC>(name, remora, cap, start, expiry, rate)
///            → remora::disc::issue(proposal, payees, per_payment_cap)   (uses settings_permit)
public fun issue<C>(p: AllowanceProposal<Balance<C>>, payees: vector<address>, per_payment_cap: u64, ctx: &mut TxContext);

/// Remora PTB (spender signs, runtime sponsors gas): withdrawal input { from: allowance } → pay.
/// Checks !paused and payee ∈ payees, spends via app_balance_spend(spend_permit), asserts value ≤ per_payment_cap
/// (an abort reverts the whole PTB), balance::send_funds(payee), emits Paid { intent = sha256(Wake.intent) }.
public fun pay<C>(disc: &Disc, a: &mut Allowance<Balance<C>>, w: AllowanceWithdrawal<Balance<C>>,
                  payee: address, intent: vector<u8>, c: &Clock, ctx: &TxContext);

/// Leaked remora key? The owner rotates the spender in place (settings_permit, guarded by an owner check).
public fun rotate<C>(disc: &Disc, a: &mut Allowance<Balance<C>>, new_spender: address, ctx: &TxContext);
public fun set_payees(disc: &mut Disc, payees: vector<address>, ctx: &TxContext);
public fun pause(disc: &mut Disc, paused: bool, ctx: &TxContext);
```

**Who enforces what:**

- **Sui** (natively): total budget, rate per window, start and expiry, spender identity, and revocation by
  the owner's non-transferable `AllowanceCap`.
- **Disc:** the payee allowlist, per-payment cap, pause, rotation without reissuing, and `Paid` events.

**Budget changes** need revoke + reissue in **one owner-signed PTB**, built by `disc-sdk`.

**Guarding permits:** any holder of `SettingsPermit<DISC>` can rotate the spender of every Disc-bound
allowance, so the functions that mint permits must check `ctx.sender() == disc.owner`.

**Fallback** (if the day-2 spike fails): a plain `Coin` escrow with the same Disc policy, clearly labeled
as a fallback.

---

## 7. Payments: facilitator, SDK, merchants

- **x402 facilitator** (`apps/facilitator`, network `sui:mainnet`):
  - **verify:** check the network and signature, simulate with **Tatum `sui_dryRunTransactionBlock`**,
    and assert that the balance change to `payTo` equals `amount` in the asset. Disc-aware mode also
    asserts that the PTB calls `remora::disc::pay`.
  - **settle:** run **Tatum `sui_executeTransactionBlock`**, wait for finality, and return the digest.
  - **gas:** acts as the gas station (`extra.gasStation`).
- **`disc.fetch(url)`:**
  1. gets a `402`;
  2. checks the soft budget in memory;
  3. builds the allowance-funded PTB;
  4. the remora signs and the runtime co-signs as gas sponsor;
  5. retries with the payment header.
- **Demo merchants** (`apps/merchants`), each a small x402 API:
  - `sui-risk`: package age, `UpgradeCap` owner and holder count, read through Tatum;
  - `odds`: a cached sports-odds snapshot;
  - `brief`: an LLM summarizer.

  Check Tatum's terms before reselling any data.

---

## 8. Memory design (where "how it learned" comes from)

| Namespace | Writer | Example | Read by |
|---|---|---|---|
| `me` | all remoras, the owner | `Timezone Asia/Ho_Chi_Minh · quiet hours 23:00–07:00 · reply in Vietnamese` | every remora |
| `remora:sentinel:rules` | `analyze()` on feedback | `RULE: treasury outflow > $5,000 to a first-time address → wake me, even in quiet hours` | Sentinel triage |
| `remora:sentinel:episodes` | Sentinel | `EVENT: 120 SUI staking reward → verdict=noise · 2026-10-22` | Sentinel (`sort: "recent"`) |
| `sources` | Scout | `SOURCE sui-risk · 9 calls · 8 useful · $0.06 per useful answer · as_of 2026-11-02` | Scout routing |
| `feedback` | the owner via chat | `Owner: "brief is a waste, never pay it more than $0.01"` | Scout. Becomes a soft rule, and is proposed as a hard Disc change |
| `budget` | runtime | `Owner approved raising Scout's monthly budget to $30 after 3 cap hits (2026-10-30)` | Next budget proposal |
| `handoffs` | any remora | `Sentinel → Scout: risk check on 0xabc… (airdrop) · answered "likely scam"` | both |
| `receipts` | runtime | Wake JSON (§9) | dashboard, audits |

**Memory inspector (dashboard):**

- `listNamespaces()` and `listMemories()` provide the metadata, and `recall` returns the text;
- **No per-memory delete exists** (measured by hippo; the Security Delete API only covers legacy V1
  blobs). So the inspector offers:
  - **Hide:** a local `hidden_at` filter that recall and dedupe honor, reversible with Unhide;
  - **Correct:** a `[correction]` memory that supersedes the old fact (newest first);
  - **Forget all:** per namespace via `POST /api/forget`, which removes index rows only.

  The UI says plainly that blobs stay on Walrus, encrypted, until they expire. Remoras can only write,
  never hide or forget.
- **Expiry:** each memory shows `expires_at` from the read API. New memories live about **210 days**
  (measured), and there's an alert under 30 days.
- every memory shows **"used in N decisions"**, linked from its Wakes;
- an "open in Walrus Console" link lets you verify independently.

**Rules of thumb:**

- Memory holds *conclusions*; Postgres holds counters.
- Read the latest state with `sort: "recent"`.
- Remember that `distance` is cosine distance, so lower means more similar.

---

## 9. Wake: receipts

Every remora action writes a Wake to the `receipts` namespace.

- Writes take about **24 s**, so a Wake is **accepted in the background**: a `memory_index` row is
  recorded at accept time, and its `blob_id` is filled in when the job lands. Failed jobs are resubmitted
  (hippo's `rememberWithDedupe` pattern).
- The relayer Seal-encrypts the Wake, so only the owner can read it. The dashboard can decrypt it in the
  browser with the owner's wallet (hippo's `wallet-read`).

```json
{
  "v": 1, "remora": "scout", "agent": "0x…", "ts": "2026-11-03T02:13:00Z",
  "intent": {
    "trigger": { "kind": "message", "ref": "tg:…" },
    "inputs": { "via": "tatum", "checkpoint": 0, "objects": [{ "id": "0x…", "version": "…" }], "sha256": "…" },
    "memories": [{ "blob_id": "…", "namespace": "sources", "distance": 0.21 }],
    "model": { "id": "anthropic/claude-sonnet-5-5", "prompt_sha256": "…" },
    "decision": { "action": "pay", "payee": "0x…", "amount": "50000", "reason": "…" }
  },
  "result": { "tx": "…", "response_sha256": "…" }
}
```

- **Anchoring:** `sha256(intent)` is computed **before** paying and passed to `disc::pay` as `intent`, so
  it lands in the `Paid` event. The full Wake, including the tx digest and response hash, is written
  after settlement. (The full Wake can't go into the transaction, because it contains that
  transaction's own digest.)
- **`remora verify <wake>` checks:**
  1. the recomputed intent hash equals `Paid.intent` (via Tatum, from the tx's events);
  2. the payment's balance change matches;
  3. every cited memory's `created_at` (from `listMemories`) precedes `ts`.

  It prints ✓/✗ for each.
- **Non-payment actions** (pings, answers) get a Wake but no onchain anchor in the MVP.
  - *Stretch:* Merkle-batch them into a periodic `Anchored` event.
  - *Stretch:* share Wakes with an auditor through a Seal grant policy (grantee + expiry + revoked flag).

---

## 10. Safety model (defense in depth)

1. **Read-only by default.** Only `pay()` moves money, and only through the Disc.
2. **Sonar check before acting.** A deterministic policy engine plus an **independent check model** runs
   before every pay or send. It sees only the trusted intent and the policy, never raw web or tool
   content. Its verdict and reasons go into the Wake.
3. **Onchain enforcement,** which no prompt can bypass:
   - Sui enforces the budget, window and expiry;
   - the Disc enforces payees, the per-payment cap and pause.
4. **Human approval above the limits:** a Telegram button opens the dashboard for an owner-signed one-off
   payment or a budget change.
5. **A Wake for every action.**
6. **Kill switches:** pause, revoke, remove the delegate key, rotate the key.

**Threat model highlights** (full version in the README):

- **What we trust:** the managed MemWal relayer (it sees plaintext), Tatum's availability, and our
  runtime's custody of remora keys. A leaked remora key loses at most its cap, and rotation fixes it.
- **What we don't trust:** web content, merchant responses, LLM output.

---

## 11. Tatum usage

| Tatum | Where | Why |
|---|---|---|
| Sui **gRPC** checkpoint stream | runtime (Sentinel), indexer | Chain-event triggers, `Paid` index |
| `sui_dryRunTransactionBlock` | facilitator, `disc-sdk` | Verify x402 payments before settling |
| `sui_executeTransactionBlock`, `sui_getTransactionBlock` | facilitator, runtime | Settle and confirm finality |
| `sui_getObject` | dashboard, runtime | Allowance `current_spend` and settings, Disc state |
| `suix_queryEvents` | dashboard, `remora verify` | `Paid` history, Wake anchoring |
| `suix_queryTransactionBlocks`, `suix_getCoinMetadata`, `suix_resolveNameServiceNames` | Sentinel | Enrich alerts (amounts, symbols, SuiNS names) |
| Data API `/v4/data/rate/symbol` | dashboard, Sentinel, `sui-risk` | USD values |
| `suix_getCoins` / balance reads | **Detect funds** (§12.1) | Split USDC between `Coin` objects and the address balance |

---

## 12. Full-product components

Each component below lists the feature IDs it covers in [remora-features.md](remora-features.md).

### 12.1 Funds model: address balance everywhere (A4)

Every USDC flow uses **Sui address balances**:

- the owner funds their address balance, and every Disc-bound allowance draws from it;
- `disc::pay` delivers with `balance::send_funds(payee)`;
- merchants keep what they receive in their address balance.

`Coin` objects only show up when money arrives from outside, such as exchange withdrawals or plain wallet
transfers.

**UI:**

- Every balance shows a split: *"$18.40 ready (address balance) · $5.00 in coins → Move"*.
- A **Detect funds** button scans the owner, each remora and each merchant address. It shows the
  coin/address-balance split and a *settling* state, because accumulator settlement is periodic.
- **Move to address balance** (`coin::send_funds`) takes one tap.
- **Withdraw to coin** (`tx.withdrawal` + `coin::redeem_funds`) sits under "Advanced", for apps that need
  a `Coin`.
- A low-balance warning appears when the address balance can't cover the remaining budget windows.

**Spike (Oct 21):** find the Tatum call that exposes the address-balance component, and measure the
settlement delay from deposit until an allowance can spend.

### 12.2 Accounts & Telegram linking (A1–A3, A5)

- **Sign-in:** a wallet (dapp-kit) in W1, zkLogin via Enoki in W3.
- **Walrus Memory account:** detect the owner's existing account or create one (one per address,
  permanent registry).
- **Telegram link:** the bot issues `/start <nonce>`, the owner signs the nonce in the dashboard, and we
  store `telegram_user_id ↔ owner_address`. Every Telegram command is authorized against this binding,
  and unknown users get only a "link your account" reply.

### 12.3 Key custody & gas sponsor (B4, D8)

- **Remora keys:** generated server-side and **envelope-encrypted at rest** (a per-key data key wrapped by
  a master key in a KMS or secret store). They're decrypted only inside the signer module, never logged
  or sent to the LLM. A leaked key loses at most its Disc cap, and **rotate** (B9) fixes it.
- **Gas sponsor:** one sponsor wallet, a per-remora daily gas budget, refusal past the budget, an admin
  alert at low balance, and per-user rate limits (I4).

### 12.4 Sonar: pre-action check (I1, I2)

Every pay or send action goes through:

1. **Intent assembly** from trusted context only: the owner's messages, the remora's config and memory
   rules. Web and tool outputs are tagged `untrusted` and can't add payees or amounts.
2. **The deterministic policy:** payee in the Disc and Reef, amount ≤ the soft limit, within the
   schedule.
3. **An independent check model,** which sees the intent and the policy, not the raw content.
4. **The Disc onchain,** which enforces the hard limits.

Steps 1–3 are recorded in the Wake. The red-team suite (I3) measures the stack and publishes "N attacks,
0 overspends".

### 12.5 Reef: x402 service directory (E7, E8, E10, E13)

- An offchain registry (Postgres + public API; snapshots published to Walrus). Each entry has a name,
  category, price, `payTo`, docs URL and facilitator.
- Disc payee lists can reference Reef entries; the runtime resolves them to addresses.
- **`@remora/merchant`** middleware turns any HTTP API into an x402 service and lists it on Reef.
- **Reputation (W4):** opt-in, aggregated Wake stats such as calls, useful rate and price.

### 12.6 Identity & hosting (B5, H6)

- **SuiNS subnames per remora** (e.g. `scout-uy.remora.sui`), via the Enoki subname API or our own parent
  name. Each remora has a human-readable onchain identity that can be resolved through Tatum
  (`suix_resolveNameServiceNames`).
- **Landing, docs and the public verify page on Walrus Sites.** Deploy with `site-builder` (needs WAL),
  served through the public portal at `*.wal.app` under a SuiNS domain.

### 12.7 Channels (H1–H3, H5, H8)

- **Telegram bot:** remoras addressed by name, inline buttons, voice notes and images (W3), and group
  chats with several remoras.
- **Telegram Mini App:** the dashboard inside Telegram, with one-tap owner approvals (signed with a wallet
  or zkLogin).
- **Notification policy:** priorities (ping / digest / silent), quiet hours, a morning digest.
- **Later:** Discord, Slack, WhatsApp.

### 12.8 Playground (H7)

A public "Try Scout" page gives each visitor a sandboxed remora with a **$1 Disc**, funded from a project
wallet. It's rate-limited and the remora is retired after 24 hours. The Disc makes this safe by
construction: the worst case is $1. It's the clearest way for judges to *use* the product rather than
watch it.

### 12.9 Memory lifecycle & portability (F4–F9)

- **Hide, correct, forget all:** see §8. There's no per-memory delete.
- **Expiry:** display plus alerts (about 210 days).
- **Index check:** compare `memory_index` against the relayer's view. `restore()` isn't a recovery path.
- **Import:** Claude Code, Codex, Cursor, ChatGPT export or Markdown, following the MemWal import guide
  (`analyze` ≤ 64 KiB per call, `remember_bulk` ≤ 20 per call, no re-runs).
- **Export:** everything as Markdown or JSON.
- **MCP mapping:** set `MEMWAL_NAMESPACE`, or pass `namespace` to `memwal_recall`, so Claude Code and
  Codex read the remoras' namespaces. `packages/mcp` adds remora-aware tools.

### 12.10 Ops (K1–K5)

- **Health dashboard:**
  - runtime;
  - **gRPC checkpoint lag** (latest checkpoint vs processed);
  - Tatum credits and rate limits;
  - Walrus Memory `health()`;
  - sponsor balance;
  - queue depth.
- **Cost tracking** per remora: tokens, Tatum credits, gas.
- **Rebuild from truth:** Postgres can be rebuilt from Sui (Disc objects, allowances, `Paid` events)
  plus the Walrus Memory read API (`GET /v1/owners/:owner/memories`, `listNamespaces`).
- **`diagnose`** (ported from hippo) gates deploys. It checks the package against `GET /config`, the
  registry against the chain, delegates, relayer health and storage expiry.

### 12.11 Hatchery: share, duplicate, publish (M1–M12)

**Template format.** `remora.yaml` (B10) is published as a Walrus blob:

```yaml
schema: remora.template/v1
name: Scout
summary: Answers questions by buying the best data, learns which sources are worth it
persona: |
  …
tools: [memory.recall, memory.remember, tatum.balances, web.fetch, pay]
triggers:
  - { kind: message }
  - { kind: cron, human: "every Monday 9am", cron: "0 9 * * 1" }
budget_suggestion: { monthly_usd: [10, 30], per_payment_usd: 0.5 }
payees: [reef:sui-risk, reef:odds, reef:brief]   # Reef references only, never raw addresses
starter_memories: []                               # opt-in pack (M2), public plaintext
examples: ["Is 0xabc… a scam token?", "What changed in my wallet this week?"]
```

**Lifecycle:**

1. **Share** (M1): a review screen, the scrubber and a Sonar scan (M7).
2. **Publish:** the blob goes to Walrus, then `remora::hatchery::publish(blob_id, parent)` emits
   `Published`. A link, QR code and Telegram deep link are generated.
3. **Gallery** (M4): reads the onchain events plus the blob content.
4. **Hatch** (M5): a consent screen listing tools, triggers and Reef payees, then the owner sets their own
   budget. The normal creation flow (B3) runs, and `Forked` records the lineage.
5. **Updates** (M8): new versions arrive as a diff; nothing auto-applies.

**Public remora** (M9) works in one of two modes:

- **Public chat:** each visitor gets a guest namespace under the owner's account (hippo's guest
  pattern), so visitors never touch the owner's private namespaces. A dedicated, capped Disc pays for the
  free quota.
- **x402 service:** other people's remoras call it and pay from their own Discs (E11).

**Safety invariants:**

- a template can never carry a private memory, a key or a raw payee address;
- hatching always shows the consent screen;
- the hatched remora starts in **shadow mode** (N3);
- the Disc limits always apply.

### 12.12 UX principles (N1–N20)

1. **Explain everything.** Every message and action has a "Why?" that opens the Wake and the cited
   memories (N4).
2. **Trust before autonomy.** New or edited remoras start in shadow mode (N3). Spending above the limits
   goes to one approval inbox (N2).
3. **One-tap control.** Pause, rotate, revoke, plus a panic button that pauses everything (N10).
   Chat-first management turns plain language into a sign link (N9).
4. **Show slow things honestly.** "Saving to Walrus (~30 s)", "settling", "relayer slow, retrying",
   and abort codes rewritten as sentences (N6).
5. **Value in 60 seconds.** Templates with good defaults, and a first-run instant win (N13).
6. **Make the learning visible.** Activity feed (N1), budget meter (N5), cost card (N15), weekly review
   (F10) and Proof of Learning (G5).

---

**Sources:**

- Sui Allowances: [overview](https://docs.sui.io/onchain-finance/allowances/allowances-overview) ·
  [API](https://docs.sui.io/onchain-finance/allowances/using-allowances)
- [x402 Sui `exact` scheme](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_sui.md)
- [Walrus Memory API reference](https://github.com/MystenLabs/MemWal/blob/dev/docs/sdk/api-reference.md)
- Positioning:
  - OpenAI Dots: [Al Jazeera](https://www.aljazeera.com/economy/2026/9/30/openai-launches-dots-personal-ai-assistant-built-to-handle-everything),
    [critique](https://www.dsebastien.net/2026-10-03-openai-dots-always-on-agents-with-a-memory-you-cant-inspect/)
  - Grok Bot: [Composio guide](https://composio.dev/blog/guide-to-frok-bot)
  - Meta Muse: [The Rundown](https://www.therundown.ai/news/meta-muse-personal-ai-agent)

  These are mostly secondary sources, so re-check them before quoting in the blog.
