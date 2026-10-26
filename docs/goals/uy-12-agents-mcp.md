# Goal U12: agents use Remora, Receipts and Kitty through MCP (a UI and an MCP server in each)

- **Owner:** Uy's agent. It may also claim the Connections page from Huấn
  ([ADR-0027](../adr/0027-flex-takeover.md)).
- **Runs in:** three checkouts, each on its own `main`:
  - Remora: `/Users/uydev/orca/projects/walrus-session-10`;
  - `/Users/uydev/orca/projects/total-recall-receipts`;
  - `/Users/uydev/orca/projects/total-recall-kitty`.
- **Depends on:** U11's wrap-up. The exit is recorded and both apps are out of Remora
  ([ADR-0065](../adr/0065-split-receipts-and-kitty-repos.md)).
- **Decision:** [ADR-0066](../adr/0066-agents-use-the-apps-through-mcp.md).
- **Network:**
  - money and Move on testnet;
  - memory on the mainnet relayer: Remora's own account for remoras, the operator account for Receipts
    and Kitty (ADR-0026, ADR-0060).
- **Features:** F14 (Remora MCP v2), RC7 (Receipts' agents), KT4 (Kitty's delegates).

**Goal:** a person's AI agent can use each app through MCP, as safely as the person uses it in the UI.
- **Remora:** an agent remembers, pays and asks for approval inside the Disc's limit.
- **Receipts:** an agent forecasts real games with a track record nobody can fake.
- **Kitty:** an agent does the pot's chores inside the group's rules.

In every app the owner gives the agent a credential in the UI, sees what it did, and can revoke it.
Anything above the onchain limits comes back to the owner.

## Before you start
- **Read:**
  - ADR-0066 and ADR-0048 (MCP v1), plus `packages/mcp`;
  - ADR-0027 (claims), ADR-0064 and ADR-0065;
  - `apps/server/src/money` (`pay`, over-limit approvals);
  - Remora's `packages/schema/src/wake.ts`;
  - in each split repo, `apps/*/README.md`, `src/wallet.ts` (Kitty) and `src/signatures.ts` (Receipts);
  - the MCP spec for Streamable HTTP (protocol `2025-06-18`).
- **Memory health:** run `bun run diagnose` in Remora and check the memory recall item.
- **Huấn's state:** his branches, open PRs, `docs/handoffs/` and recent commits.
  - Claim the Connections page only if he hasn't started it, with a note in `docs/handoffs/`.
  - If he has started it, hand him the API instead.
- **SUI:** keep the burner and the sponsor ≥0.05 SUI each. The spike owner holds both `UpgradeCap`s.

## Part A: Remora, MCP v2 (F14)
1. **Contract PR, first.** It is additive, and each shape comes with a fixture:
   - `McpToken`: id, remora, name, scopes, created, expires, last used, revoked;
   - `McpCall`: tool, time, ok, Wake id, spend;
   - `Wake.via`: optional, for example `mcp:claude-code`.

   Request Huấn's review, and merge when it's green, as with #8 and #10.
2. **Tokens (server):**
   - create, list and revoke tokens;
   - a token is shown once, and only its SHA-256 is stored;
   - scopes are `memory:read`, `memory:write`, `pay` and `approve:request`;
   - every call is rate-limited per token and logged as an `McpCall`;
   - a revoked or expired token gets 401, and a missing scope gets 403.
3. **Tools:**
   - the v1 tools `remoras_list`, `remora_recall` and `wake_get`, plus:
   - `remora_remember`:
     - `episode` and `source` only;
     - through the secret scrubber (F11);
     - tagged `[by:mcp:<client>]`;
     - a `rule` becomes a proposal the owner confirms.
   - `reef_search`;
   - `pay`: `disc.fetch` through the remora's Disc, writing a Wake with `via`;
   - `approval_request`: an over-limit payment becomes the E4 approval;
   - `wake_verify`;
   - `remora_ask`: a turn, with a step limit.

   Results from third parties go back wrapped as untrusted.
4. **Transports:**
   - stdio (`packages/mcp`, which now takes a token as well as the session);
   - Streamable HTTP at `/mcp` on the server, with the bearer token, JSON-RPC 2.0 and SSE only where the
     spec needs it.

   One tool implementation serves both transports.
5. **UI (claimed, or handed over):**
   - a Connections page: create a token (name, remora, scopes, expiry), shown once with a ready-to-paste
     `claude mcp add` line;
   - the list of tokens with their last use, calls, spend and memories;
   - revoke;
   - Wakes show "via MCP: <client>".

   Use Huấn's kit and Remora's page components.
6. **Evals:** add MCP attacks to `evals/`:
   - a token without `pay` tries to pay;
   - a revoked token;
   - an injected instruction in a tool result tries to pay a non-Reef payee;
   - an attempt to spend over the Disc.

   Each one is caught, and CI runs the deterministic part.

## Part B: Receipts, agents as forecasters (RC7, total-recall-receipts)
1. **Delegation:**
   - the owner's wallet signs: "Receipts: let agent `<address>` (`<name>`) pick for me in group `<id>`
     until `<date>`";
   - stored, revocable, and shown in the UI.
2. **Agent picks:**
   - the agent signs the pick message with its own key;
   - the server checks the delegation and the signature;
   - the receipt shows "agent X for Y";
   - verify checks the pick signature, the delegation and the anchor;
   - the leaf format follows ADR-0064's versioning, and old leaves still verify.
3. **Learning:**
   - agents are voices (`agent:<address>`) in the scores and the trust snapshots;
   - the leaderboard and the Learning page show agents next to the books, the markets and people.
4. **MCP:** `list_markets`, `get_call` (with its cited memories), `submit_pick`, `get_receipt` and
   `leaderboard`.
   - **stdio** holds the agent's key (`RECEIPTS_AGENT_KEY`) on the agent's side.
   - **Remote `/mcp`** gives read tools with a token, plus picks only if the owner opts into a key
     Receipts holds for the agent. A pick signed that way says "custodial" on its receipt.
5. **Web:** an Agents page with delegate (a wallet signature), revoke, the MCP config, and each agent's
   record.
6. **Reference agent:** `apps/receipts/agents/forecaster`, an OpenRouter model (`LLM_SMALL_MODEL`) that
   uses the MCP server. It reads the board and Receipts' call, decides a side and a confidence with a
   one-line reason, and picks.
7. Write an ADR in this repo (next free number) and update the README.

## Part C: Kitty, agents with a mandate (KT4, total-recall-kitty)
1. **Move upgrade on testnet, as a Move PR.** Merge it when green, then upgrade with the spike owner's
   `UpgradeCap`.
   - `set_delegate(pot, agent, approve_cap)` and `revoke_delegate`, called by the member. Store them in
     dynamic fields, because `Pot`'s layout can't change in an upgrade.
   - `propose_as_delegate` and `approve_as_delegate`. Approving aborts above the cap (`EOverDelegateCap`),
     and when the member has left.
   - Bump the version, and add `sui move test` for each abort and for revocation.
2. **Server:** the agent signs through the prepare/execute flow (ADR-0064), sponsored. The server never
   holds the agent's key.
3. **MCP:** `pot_status`, `why`, `norms`, `propose_spend` and `approve`.
   - stdio holds the agent's key;
   - remote `/mcp` gives read tools with a token.
4. **Web:**
   - "Your agent" on the pot page: delegate, cap, revoke, the MCP config;
   - proposals show "approved by Bao's agent";
   - above an agent's cap, the page shows "needs you".
5. **Reference agent:** `apps/kitty/agents/treasurer`, an OpenRouter model. It reads the pot and the
   norms memory, approves or declines a spend with a reason that cites a memory blob, and proposes a
   spend with a quote.
6. Write an ADR in this repo (next free number) and update the README.

## U12 exit (testnet)
Run each exit once, and re-run only a failed step after its fix.

1. **Remora:**
   - Claude Code connects over stdio, and a script connects over HTTP, each with its own token.
   - `remora_remember` → the blob lands, and `remora_recall` finds it.
   - `pay` buys a Reef answer within the Disc. Its Wake says `via mcp:…`, and `/verify` passes.
   - An over-limit `pay` aborts at the Disc. `approval_request` creates the approval, and the owner
     approves it in the web.
   - A token without `pay` gets 403, and a revoked token gets 401.
   - The Connections page shows the calls and the spend.
2. **Receipts:**
   - The owner delegates the forecaster in the web.
   - The forecaster picks two real upcoming games through MCP (stdio). Both are anchored, and each
     receipt verifies its signature, its delegation and its anchor.
   - A pick after the delegation is revoked is refused.
   - If a game resolves during the run, the agent shows up in a new trust snapshot. Otherwise, say so.
3. **Kitty:**
   - On a fresh "(test)" pot, Bao delegates the treasurer with a $0.10 cap, onchain.
   - The treasurer approves a $0.05 spend, which executes at quorum. Its reason cites a memory.
   - Its approval of a $0.20 spend aborts onchain (`EOverDelegateCap`, a committed failed transaction).
     Bao approves it in the web.
   - After a revoke, the treasurer's approval aborts.
4. **The UI shows each agent's actions in all three apps,** at desktop and 375 px, in light and dark.

## Finish
- **Record `docs/spikes/<date>-u12-exit.md`:**
  - digests, blobs and timings;
  - Tatum usage;
  - what's verified and what isn't;
  - the list for Uy.
- **Each split repo:** add its own exit doc, update its README, and keep CI green.
- **Update:**
  - `docs/remora-features.md` (F14);
  - the README's MCP section;
  - the threat model;
  - the goals README;
  - a landed handoff to Huấn.
- **Stop** every service, stream and poller.

## Done when
- [ ] The contract PR and the Kitty Move PR are merged, and the Kitty upgrade is on testnet.
- [ ] The U12 exit passes, or each failing step names its blocker in the spike doc.
- [ ] typecheck, lint, test, `sui move test`, evals and CI are green in all three repos.
- [ ] The ADRs, READMEs, exit docs and handoff are written, and everything is pushed to each `main`.

## Never
- Mainnet money or a mainnet publish, or a deploy (U9 deploys).
- A key in an MCP response, a log or a commit; a token stored in plain text; printed key values.
- Committing `.env`, or force-pushing.
- An agent action above an onchain limit that doesn't go back to its owner.
- Editing `reference/`, Huấn's paths (except a claimed item) or `packages/schema` (except the contract
  PR).
- Rewriting an accepted ADR.
- An unfiltered checkpoint stream, or two pollers on one bot token.
- Invented data presented as real. An agent's picks and approvals are labelled as an agent's.
- A decision without an ADR in the same commit.
