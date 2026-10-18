# Tech Reference: Walrus Memory + Tatum

A builder's cheat sheet for Total Recall, taken from the official docs on 2026-10-18. Walrus Memory is in
beta and changes often, so check the linked pages before you rely on a detail.

---

## 1. Walrus Memory (MemWal)

### 1.1 What it is

A memory layer for AI agents that keeps context across sessions, apps and tools. Memories are:

- **embedded** for semantic search (by the relayer),
- **encrypted with Seal**,
- **stored as blobs on Walrus**,
- **owned onchain**: Sui smart contracts enforce ownership and delegate access.

Core operations:

| Operation | What it does |
|---|---|
| `remember` | Store one memory (embedding, Seal encryption, Walrus upload and indexing run as a background job) |
| `recall` | Semantic search scoped to `owner + namespace`; returns decrypted text |
| `analyze` | An LLM extracts facts from long text; each fact is stored as its own memory |
| `ask` | Answer a query from recalled context plus LLM reasoning (listed in the Python SDK) |
| `restore` | Rebuild a lost index from Walrus by owner + namespace, re-embedding only missing entries |

### 1.2 Key concepts

- **Memory space** = `owner address + namespace + app (package) ID`. It is the isolation boundary.
- **Owner:** a Sui address. It is the root authority over the account.
- **Delegate key:** an Ed25519 keypair the owner authorizes. Delegate keys are **registered onchain and
  verified on every request**, and the owner can add or remove them. This is how an app or agent writes to a
  *user's* memory without owning it.
- **Namespace:** a label you choose, such as `rules`, `picks` or `group:123`. It defaults to `"default"`.
  Use one per product surface.
- **Account ID:** the `MemWalAccount` object ID on Sui.

### 1.3 Endpoints

| Network | Relayer URL |
|---|---|
| **Mainnet (required for the hackathon)** | `https://relayer.memory.walrus.xyz` |
| Testnet (staging) | `https://relayer-staging.memory.walrus.xyz` |

The managed relayer is a public good run by the Walrus Foundation: the server wallet pays Walrus storage
fees, there is no SLA, usage limits may apply, and **the relayer sees plaintext** during embedding and
encryption. For client-side encryption, use `MemWalManual`.

> Some docs pages (for example "Agent Storage Loop") use the **staging** relayer in their samples. The
> hackathon requires **Mainnet**, so don't copy those URLs as-is.

### 1.4 Install and configure (TypeScript)

```bash
pnpm add @mysten-incubation/memwal
# optional peers: ai (AI SDK middleware), @mysten/sui @mysten/seal @mysten/walrus (manual client)
```

```ts
import { MemWal } from "@mysten-incubation/memwal";

const memwal = MemWal.create({
  key: process.env.MEMWAL_KEY!,              // delegate private key (hex, 0x-hex, suiprivkey1..., or Uint8Array)
  accountId: process.env.MEMWAL_ACCOUNT_ID!, // MemWalAccount object ID on Sui
  serverUrl: "https://relayer.memory.walrus.xyz",
  namespace: "my-app",                       // default "default"
  // requestTimeoutMs: 30000, recallTimeoutMs: 15000, preflightTimeoutMs: 5000
});

await memwal.health(); // reachability only; does NOT validate key/accountId
```

Python: `pip install memwal` (extras: `[langchain]`, `[openai]`, `[all]`). The `MemWal.create(key=..., account_id=..., server_url=..., namespace=...)` call mirrors the TS client.

### 1.5 API surface (TS `MemWal`)

| Method | Returns / notes |
|---|---|
| `remember(text, namespace?)` | `{ job_id, status }`. Async background job |
| `rememberAndWait(text, namespace?, opts?)` | `{ id, job_id, blob_id, owner, namespace }` |
| `getRememberStatus(jobId)` | `pending \| running \| uploaded \| done \| failed \| not_found` |
| `waitForRememberJob(jobId)` | Polls until `done` or `failed` |
| `rememberBulk(items)` / `rememberBulkAndWait(items)` | **Up to 20 items per call** (Walrus Quilt shares Sui txs). Chunk larger sets |
| `recall({ query, limit?, namespace?, maxDistance?, sort?, scoringWeights?, timeoutMs? })` | `{ results: [{ blob_id, text, distance, created_at? }], total }`. `limit` defaults to 10, max 100 |
| `analyze(text, namespace?)` / `analyzeAndWait(...)` | `{ job_ids, facts: [{ text, id, job_id }], fact_count, ... }` |
| `restore(namespace, limit?)` | `{ restored, skipped, failed, total, namespace, owner }` |
| `listNamespaces({ cursor?, limit? })` | Namespace metadata (`memory_count`, `storage_used`, ...) |
| `listMemories({ cursor?, limit?, namespace? })` | Metadata only, no decrypt (`blob_id`, `created_at`, `importance`, `agent_id`, ...) |
| `health()`, `compatibility()`, `getPublicKeyHex()` | Diagnostics |
| `embed(text)`, `rememberManual(...)`, `recallManual(...)` | Low-level, bring your own vectors or encryption |

Account management (`@mysten-incubation/memwal/account`): `generateDelegateKey()`, `createAccount()`,
`addDelegateKey()`, `removeDelegateKey()` (owner only; needs `registryId`).

Deletion guides: [delete memories programmatically](https://github.com/MystenLabs/MemWal/blob/dev/docs/guides/delete-memories-programmatically.md).

### 1.6 Recall gotchas (these matter for "learning" apps)

- **`distance` is cosine distance: lower means more similar.** The MCP tool shows `score = 1 - distance`, the
  opposite polarity, so don't mix them.
- **The default ranking is relevance only, with no recency guarantee.** To get the *latest* state (a current
  trust score, the newest rule), use `sort: "recent"`. Sorting client-side does **not** work, because the
  newest record may never make it into the result set.
- `sort: "recent"` over-fetches (`limit * 5`, capped at 50) and then orders by `created_at`.
- `scoringWeights: { semantic, recency, recencyHalfLifeDays, importance }` only **re-ranks** the returned
  candidates. It does not widen the search, and it's ignored when `sort` is set.
- `created_at` is the **write time**, not a date mentioned in the text.
- `maxDistance` filters client-side, after selection.

### 1.7 Design rule of thumb

Walrus Memory is **semantic memory, not a database**. Use it for what the product *learned* (rules,
preferences, trust snapshots, insights) and for durable *receipts*. Keep counters, joins and balances in a
normal DB, and write the conclusions back to memory. Format memories as short, self-describing sentences or
`KEY: value` lines so semantic recall finds them.

### 1.8 AI SDK middleware

```ts
import { withMemWal } from "@mysten-incubation/memwal/ai";

const model = withMemWal(baseModel, {
  key, accountId, serverUrl, namespace: "chat",
  maxMemories: 5,      // memories injected per request
  autoSave: true,      // analyze() the user message after generation
  minRelevance: 0.3,   // 0..1 similarity threshold
});
```

Before generation it recalls on the last user message and injects matches as a system message. After
generation it optionally runs `analyze()` and saves facts in the background. Use direct SDK calls when you
need precise control. Remora does, so that every decision can cite the memories it used (see
[remora-spec.md](remora-spec.md)).

### 1.9 Portable memory in AI tools (MCP)

Claude Code:

```
/plugin marketplace add MystenLabs/MemWal
/plugin install memwal@memwal-plugins
```

Tools: `memwal_login`, `memwal_remember`, `memwal_recall`. Codex, Cursor, Claude Desktop, Antigravity and
OpenCode are also documented under `docs.wal.app/walrus-memory/mcp/`. The same account gives the same
memories in every tool, which makes a strong "portable memory" demo.

### 1.10 Docs map

- Overview: https://docs.wal.app/walrus-memory
- Quick start: https://docs.wal.app/walrus-memory/getting-started/quick-start
- TS SDK: https://docs.wal.app/walrus-memory/sdk/overview
- Full API reference (source): https://github.com/MystenLabs/MemWal/blob/dev/docs/sdk/api-reference.md
- Multi-tenant apps: https://docs.wal.app/walrus-memory/sdk/cookbook-multi-tenant
- Agent storage loop: https://docs.wal.app/walrus-memory/sdk/agent-storage-loop
- Ownership and delegates: https://docs.wal.app/walrus-memory/fundamentals/concepts/ownership-and-access
- Example apps (Chatbot, Noter, Researcher): https://github.com/MystenLabs/MemWal/tree/dev/apps
- Single-file agent guide: https://github.com/MystenLabs/MemWal/blob/dev/SKILL.md

### 1.11 Field notes (measured on mainnet by hippo)

These come from hippo's `docs/MEMWAL-NOTES.md` and `docs/SPIKES.md` (SDK 0.1.8, Sep–Oct 2026). See
[reuse-from-hippo.md](reuse-from-hippo.md). Re-check them against the SDK version installed on Oct 20.

| Topic | What was measured | What Remora does |
|---|---|---|
| Package ID | The docs name an old package. The relayer runs an upgrade, and **two deployments are live on mainnet**. `GET /config` gives the current `packageId` but no registry ID | Read the package from `/config`, pin a matching registry, and gate deploys on `diagnose` |
| Writes | About **24 s** per write. Jobs can die (`seal encrypt failed … Too Many Requests`) | Never block a reply or payment on a write. Resubmit failed jobs up to 3 times. Record the index row at accept time |
| Recall | Sometimes returns `results: []` with `dropped_count > 0` (it found matches, then dropped them) | Retry 4 times with backoff before believing an empty result |
| Recall form | Only the **object form** `recall({ query, limit, namespace, maxDistance })` worked; the positional form dropped matches | Object form only |
| Distances | Question-shaped queries put true positives at **0.449–0.777** | `maxDistance` 0.8 for questions, dedupe at < 0.25 (except corrections) |
| Corrections | They get lost to dedupe, to the model forgetting to write, and to being outranked | Dedupe a correction only against earlier corrections; run a second recall on the `[correction]` tag; order by `created_at`, newest first |
| Rate limits | **60 weighted requests/min per delegate key** on writes, 200/min on the read API | A per-key limiter. Each remora has its own key, so its own budget |
| Delegates | **At most 20 delegate keys per account.** Removal bumps the Seal rotation counter. Revocation takes effect after about **32 s** | Cap of about 18 remoras per owner. The UI says "within about a minute" |
| Sponsorship | The relayer's `/sponsor` accepts **exactly one** of `create_account` / `add_delegate_key` / `remove_delegate_key` per tx. The user needs no SUI | Delegate registration goes through relayer sponsorship. Allowance + Disc go through Remora's own gas sponsor |
| Deletion | **There's no way to delete a current memory.** `POST /api/forget` removes index rows for a whole namespace. The Security Delete API only cleans up legacy V1 blobs | Hide one memory with a local `hidden_at` filter; "forget all" is per namespace. Tell users plainly that blobs persist until expiry |
| Expiry | New memories live about **210 days** (read API `expires_at`) | Show expiry; renewal is a later concern |
| `restore()` | Reported `total: 0` for namespaces that had memories | Don't rely on it. Rebuild from `memory_index` + `GET /v1/owners/:owner/memories` |
| Read API | `GET /v1/owners/:owner/memories` returns metadata only (no text); `/agents` lists delegates (flaky) | The inspector reads text through recall, or Seal-decrypts in the browser with the owner's wallet |
| Owner decrypt | Mainnet memories use the committee Seal server, which needs an **Enoki Seal API key** for direct decryption | hippo's browser `wallet-read` flow, reused for Wake decryption |
| zkLogin | A zkLogin address depends on the OAuth client ID, so the same Google account gets a different address than on memory.walrus.xyz | Use a **Slush wallet** for the Claude Code portability demo |
| `withMemWal` | `autoSave` analyzes every message, which produces low-quality duplicate facts | Not used. Writes stay explicit |
| Vietnamese | Byte-identical round trip; cross-language recall 8/8 | Fine for EN/VI users |

---

## 2. Tatum

### 2.1 Auth

Get an API key from https://dashboard.tatum.io/ and send it as the **`x-api-key`** header, both for HTTP
and as gRPC metadata. Remora uses the key only for gRPC and the Data API (no JSON-RPC, ADR-0021).

### 2.2 Sui RPC gateway: **gRPC only** ([ADR-0021](adr/0021-sui-grpc-only.md))

| Network | gRPC (native, `x-api-key` metadata) | JSON-RPC |
|---|---|---|
| **Mainnet** | `https://sui-mainnet-grpc.gateway.tatum.io` | not used (deprecated) |
| Testnet | `https://sui-testnet-grpc.gateway.tatum.io` | not offered by Tatum (404) |

- **Sui deprecated JSON-RPC.** Public fullnodes reject it ("JSON-RPC on public fullnodes has been
  deprecated"), so **Remora uses gRPC everywhere**
  ([Tatum migration guide](https://docs.tatum.io/docs/sui-migration-guide-from-json-rpc-to-grpc)).
- **Tatum speaks native gRPC** (`application/grpc`). `@mysten/sui`'s `SuiGrpcClient` defaults to
  gRPC-web and fails with "unexpected response content type: application/grpc".
  - **Server side (verified in U1):** `new SuiGrpcClient({ network, transport })` with a
    `GrpcTransport` from `@protobuf-ts/grpc-transport` + `@grpc/grpc-js`:
    `host: "sui-<net>-grpc.gateway.tatum.io:443"`, `ChannelCredentials.createSsl()`,
    `meta: { "x-api-key": key }`. It lives in `@remora/chain` (`createTatumSuiClient`).
  - **Browser:** gRPC-web against a public fullnode (`https://fullnode.<network>.sui.io:443`), or go
    through our API.
- Build transactions client-side with the Sui SDK. Tatum doesn't support `unsafe_*` helpers.

gRPC v2 services we use:

| Need | Service / method |
|---|---|
| Simulate (dry-run) | `TransactionExecutionService.SimulateTransaction` |
| Execute / settle | `TransactionExecutionService.ExecuteTransaction` |
| Transaction + events by digest | `LedgerService.GetTransaction` / `BatchGetTransactions` |
| Objects (allowance, Disc, UpgradeCap) | `LedgerService.GetObject` / `BatchGetObjects` |
| Checkpoints, chain info | `LedgerService.GetCheckpoint` / `GetServiceInfo` |
| Balances (coins + address balance) | `StateService.GetBalance` / `ListBalances`: `Balance` has `balance`, `address_balance` and `coin_balance` separately (U1) |
| Owned objects, coin info, dynamic fields | `StateService.ListOwnedObjects` / `GetCoinInfo` / `ListDynamicFields` |
| Live chain events (triggers, indexer) | `SubscriptionService.SubscribeCheckpoints` |
| Move introspection | `MovePackageService.GetPackage` / `GetFunction` / `GetDatatype` |
| SuiNS | `NameService.LookupName` / `ReverseLookupName` |

**There's no gRPC equivalent** of "query events by type" or "transactions by address". History, such as
`Paid` events or payments to a merchant, comes from our own indexer, fed by `SubscribeCheckpoints`.

### 2.3 Data API (`/v4/data/...`)

| API | Paths |
|---|---|
| Prices & exchange rates | `/v4/data/rate/symbol`, `/v4/data/rate/symbol/batch`, `/v4/data/rate/contract`, `/v4/data/rate/symbol/OHLCV`, `/v4/data/rate/price-change`, `/v4/data/rate/history` (price at any block or timestamp; 50 credits/call) |
| Wallet | `/v4/data/wallet/portfolio`, `/v4/data/wallet/balance/time`, `/v4/data/wallet/reputation` |
| Tokens | `/v4/data/tokens`, `/v4/data/owners`, `/v4/data/tokens/trending`, `/v4/data/tokens/popular` |
| Transactions | `/v4/data/transaction/history`, `/v4/data/transactions/hash` |

Exchange rates cover crypto↔fiat and fiat↔fiat across 165+ fiat currencies. **Check chain support per
endpoint.** Many Data API endpoints are EVM/UTXO-first, so for Sui-native data use the Sui RPC.

### 2.4 Notifications (webhooks)

`/v4/subscription`, `/v4/subscription/webhook`, ... Call `GET /v4/subscription/chains` (free) to see whether
Sui alerts are supported before designing around them. The fallback is the gRPC checkpoint stream.

### 2.5 Tatum AI Builder

[ai.tatum.io](https://ai.tatum.io) generates a working blockchain app from one prompt. Showcase apps run on
`*.tatum.app`, and one of them (AgentPact) already uses Walrus. Related tools: **Blockchain MCP** (68 chains,
13 tools, read-only by default) and **Tatum Skills** (codegen guidance). The **Best Tatum AI Builder App**
prize requires the product to be built *primarily* with it.

### 2.6 Docs map

- Docs index (LLM-friendly): https://docs.tatum.io/llms.txt
- Sui RPC: https://docs.tatum.io/reference/rpc-sui
- Sui gRPC: https://docs.tatum.io/reference/sui-grpc
- Exchange rates: https://docs.tatum.io/docs/exchange-rates
- Notifications: https://docs.tatum.io/docs/notifications

---

## 3. Sui primitives Remora relies on

### 3.1 Native Allowances (`sui::allowance`, mainnet since Oct 9, protocol v138)

> **Verified in U1 (Oct 18)**, details in [docs/spikes/2026-10-18-allowance.md](spikes/2026-10-18-allowance.md):
>
> - It's enabled on both networks (`enable_allowances`, `enable_accumulators`; testnet is on protocol
>   139).
> - **Building needs Sui CLI ≥ 1.81.** 1.74's bundled framework has no `sui::allowance`. We pin
>   1.82.1.
> - `propose_for_app` is `entry`, so a PTB can call it but Move code can't. `issue` **returns no ID**, so
>   app policy can't be keyed by allowance ID at issue time (the stub keys it by `(funder, name)`).
> - Read the address-balance part with `StateService.GetBalance` (`address_balance` / `coin_balance`).

A **funder** lets a **spender** pull from the funder's *address balance*, within limits. Nothing is locked
or set aside: funds leave only when a spend succeeds.

> **Address balances vs coins.** Total balance = the sum of `Coin<T>` objects + the address-balance
> value.
>
> - A normal `transfer::public_transfer` of a coin creates **`Coin` objects** at the recipient. Deposit
>   into the address balance with `coin::send_funds` / `balance::send_funds`.
> - Withdraw with `tx.withdrawal()` → `coin::redeem_funds`.
> - Settlement is **periodic**, not instant.
> - Address balances can't be wrapped inside objects.
>
> Remora keeps **all** USDC in address balances and exposes a **Detect funds** button
> ([remora-spec.md §12.1](remora-spec.md#121-funds-model-address-balance-everywhere-a4)).
> Docs: [address balances](https://docs.sui.io/onchain-finance/asset-custody/address-balances).

**Issue (direct):**

```move
entry fun new<T>(name: String, spender: address,
    lifetime_cap: Option<u256>, start_timestamp_ms: Option<u64>,
    expiration_timestamp_ms: Option<u64>, rate_limit: Option<RateLimit>, ctx: &mut TxContext)
```

- `T` is a balance type, e.g. `Balance<0x2::sui::SUI>`.
- At least one of `lifetime_cap` / `rate_limit` must be set, **and** at least one of
  `expiration_timestamp_ms` / `rate_limit`.
- It creates a **shared** `Allowance` and sends a non-transferable `AllowanceCap` to the funder.

**Rate limits:** `periodic_rate_limit(period_ms, limit)`, `calendar_rate_limit(months, limit)`,
`monthly_rate_limit(limit)`, `quarterly_rate_limit`, `yearly_rate_limit`.

- Windows are **fixed, not sliding**, and unused amounts don't carry over.
- Periodic windows count from the **first spend**; calendar months are UTC.

**App-bound** (what the Disc uses):

```move
entry fun propose_for_app<T, A>(name, spender, lifetime_cap, start, expiration, rate_limit, ctx: &TxContext): AllowanceProposal<T>
public fun issue<T, A>(proposal: AllowanceProposal<T>, _: SettingsPermit<A>, ctx: &mut TxContext)
```

- Only the module that defines `A` can call `std::internal::permit<A>()`.
- From that permit it derives `allowance::settings_permit(...)` (to issue and rotate the spender) and
  `allowance::spend_permit(...)` (to spend via `app_balance_spend`).
- **Any holder of `SettingsPermit<A>` can rotate the spender of every allowance bound to `A`, so guard the
  minting functions.**

**Spend:** a PTB from the spender with three parts:

1. a funds-withdrawal input (`SenderAllowance { funder, allowance }`);
2. the allowance as a mutable shared input;
3. `balance_spend` (direct) or `app_balance_spend` (app-bound), which returns `Balance<C>`.

Failed pre-checks are rejected **before execution, with no gas charged**. The spender is the sender.
Gas can come from a separate sponsor (`AllowanceWithdrawal.is_sponsor` concerns where the *funds* come
from and is always false today). U1 confirms sponsored gas on testnet.

**TS SDK:**

- shortcut: `tx.balance({ allowance, balance })`;
- manual: `tx.withdrawal({ amount, type, from: 'allowance', allowance, funder })` → `moveCall`;
- for app-bound allowances, use `{ objectId, app: { type, permit } }`;
- send funds onward with `0x2::balance::send_funds`.

**Revoke:** `revoke<T>(cap: AllowanceCap<T>, allowance: Allowance<T>)` deletes both. There's **no
in-place update**, so changing terms means revoke + reissue.

**Read state:**

- `settings.{funder, spender, app, lifetime_cap, rate_limit, start_timestamp_ms, expiration_timestamp_ms}`
  and `current_spend`;
- find caps with the owned-object filter `0x2::allowance::AllowanceCap<...>`.

**The module emits no events.** Issue and revoke show up as created and deleted objects, and spends show
up as balance changes on the funder.

Docs: [overview](https://docs.sui.io/onchain-finance/allowances/allowances-overview) ·
[using allowances](https://docs.sui.io/onchain-finance/allowances/using-allowances).

### 3.2 x402 on Sui (`exact` scheme)

**PaymentRequirements:**

```json
{
  "scheme": "exact",
  "network": "sui:mainnet",
  "amount": "10000000",
  "asset": "0x2::sui::SUI",
  "payTo": "0x…",
  "maxTimeoutSeconds": 60,
  "extra": { "gasStation": "https://…" }
}
```

- **Client:** signs the **complete transaction** and sends `{ signature, transaction (base64) }`, so the
  facilitator can't redirect funds.
- **Facilitator verify:**
  1. the network matches;
  2. the signature is valid;
  3. a **simulation** succeeds and the tx hasn't already been executed;
  4. the `payTo` balance change equals `amount` in `asset`.
- **Settle:** broadcast the tx with the client's signature and return the result.
- **Sponsorship (optional, interactive):** the client sends a gasless partial tx to `extra.gasStation`,
  gets a complete tx back, signs it, and the facilitator co-signs as sponsor at settlement.
- **Caveats:**
  - the spec talks about `Coin<T>` transfers, and lists address balances as "in development";
  - verification is based on balance changes, so confirm early that allowance-funded payments (which use
    `send_funds` into address balances) pass. The fallback is `coin::from_balance` + transfer.

Spec: [scheme_exact_sui.md](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_sui.md).

### 3.3 Gas

- **Sponsored transactions:** the sender and the sponsor both sign. Remora's runtime sponsors every
  remora transaction, so remoras hold no SUI.
- **Gasless stablecoin lane** (since May 20, 2026): only simple transfers of 7 approved stablecoins
  through address balances, with gas price and budget set to 0. It's capped at **about 300 transfers per
  second network-wide** (`gasless_max_tps`). **Allowance spends and app calls don't qualify.**

### 3.4 Seal (stretch only for Remora)

Remora's Wakes are encrypted by the Walrus Memory relayer, which uses Seal under the hood. Calling Seal
directly is only needed for the auditor-sharing stretch goal.

- **Mainnet committee:** 5-of-8, and it **needs an API key from Enoki**.
- **Testnet committee:** 3-of-5, open for basic use.
- `seal_approve*` rules:
  - the first argument is `id` without the package prefix;
  - abort to deny;
  - no `Random`, and avoid rapidly changing state.

Docs: [using Seal](https://docs.sui.io/sui-stack/seal/using-seal) ·
[key servers](https://docs.sui.io/sui-stack/seal/pricing).

---

## 4. Environment template

```bash
# .env.example
# Tatum
TATUM_API_KEY=
TATUM_SUI_GRPC=https://sui-mainnet-grpc.gateway.tatum.io
TATUM_SUI_GRPC_TESTNET=https://sui-testnet-grpc.gateway.tatum.io
TATUM_API_KEY_TESTNET=
# Walrus Memory
MEMWAL_KEY=                 # delegate private key (never commit)
MEMWAL_ACCOUNT_ID=          # MemWalAccount object ID
MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz
# Sui / Remora
SUI_NETWORK=mainnet
REMORA_PACKAGE_ID=          # published remora Move package (disc module)
SPONSOR_PRIVATE_KEY=        # runtime gas sponsor (never commit)
USDC_COIN_TYPE=             # native USDC coin type on Sui mainnet
# App
TELEGRAM_BOT_TOKEN=
AI_GATEWAY_API_KEY=
DATABASE_URL=
```
