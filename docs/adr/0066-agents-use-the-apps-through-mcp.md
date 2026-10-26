# ADR-0066: Agents use Remora, Receipts and Kitty through MCP, with scoped tokens and onchain limits

- **Status:** Accepted
- **Date:** 2026-10-25
- **Deciders:** Uy

## Context
On Oct 25 Uy asked whether Receipts and Kitty could turn toward AI, so that a person's agent uses them
instead of the person ("kiểu thay vì user xài thì user agent của họ xài"). He then asked for the same in
Remora ("thêm feature MCP cho agent nữa là ok nhỉ, sẽ có UI và MCP luôn"), all in one goal, U12.

What exists today:
- **Remora's MCP server, F9** ([ADR-0048](0048-u7-hatchery-learning-memory-runtime.md)):
  - read-only: `remoras_list`, `remora_recall` and `wake_get`;
  - stdio only;
  - signed in with the owner's session.
- **Receipts and Kitty** ([ADR-0064](0064-receipts-kitty-web-with-wallets.md),
  [ADR-0065](0065-split-receipts-and-kitty-repos.md)) have a web where people sign with their own wallet.
  They have no agent interface.

The risk in giving agents a way in is that they get more power than the owner meant to give. Each app
already has a limit an agent can't argue with:
- Remora has the Disc;
- Kitty has its allowances, quorum and auto-ok cap;
- Receipts has the signature and the anchor before lock.

The design keeps every agent action inside those limits.

## Decision
**One rule for all three:** an agent acts only through MCP or the API, with a credential its owner
created in the UI and can revoke. Money moves only inside the onchain limits. Anything above them goes
to the owner, who approves it in the UI or in Telegram. Each app has both a UI and an MCP server.

- **Remora (MCP v2, F14):**
  - **New tools:**
    - `remora_remember`: writes `episode` and `source` memories only, through the secret scrubber,
      tagged `[by:mcp:<client>]`. A `rule` needs the owner's confirmation.
    - `reef_search`.
    - `pay`: the remora's Disc pays an x402 service (`disc.fetch`), so the onchain limit applies.
    - `approval_request`: a payment over the Disc becomes the existing over-limit approval (E4).
    - `wake_verify`.
    - `remora_ask`: a turn of a remora.
  - **Transports:** stdio, plus Streamable HTTP at `/mcp` on the server, so cloud agents can connect.
  - **Credentials:**
    - per-client MCP tokens, created in the web and shown once;
    - stored hashed, bound to one remora, with scopes (`memory:read`, `memory:write`, `pay`,
      `approve:request`) and an expiry;
    - revocable at any time.

    The stdio server takes a token too; the session path stays for local use.
  - **Keys:** MCP never sees a key. The remora's key stays with the signer.
  - **Wakes:** every MCP action writes a Wake that names its client (`via`, an additive contract
    change).
  - **UI:** a Connections page:
    - tokens and their scopes;
    - each client's recent calls, spend and memories;
    - revoke;
    - a ready-to-paste `claude mcp add` line.

    It's in Huấn's lane, so U12 claims it under [ADR-0027](0027-flex-takeover.md) if he hasn't started
    it.
- **Receipts (agents as forecasters):**
  - **Delegation:** the owner's wallet signs a delegation that lets an agent's address pick for them in
    one group until a date.
  - **Agent picks:** the agent signs each pick with its own key. The receipt shows "agent X for Y", and
    verify checks the pick signature, the delegation and the anchor.
  - **Scoring:** agents are voices like any other, scored against the books and the markets. Receipts'
    trust memories learn which agent to trust, on what.
  - **MCP tools:** `list_markets`, `get_call`, `submit_pick`, `get_receipt` and `leaderboard`.
    - **stdio, the default:** it holds the agent's key on the agent's side.
    - **remote:** read tools only, unless the owner opts into a key Receipts holds for the agent. A
      pick signed that way says so on its receipt ("custodial").
  - **Web:** an Agents page to delegate, revoke and copy the MCP config, plus agents on the
    leaderboard and the Learning page.
- **Kitty (agents with a mandate):**
  - **Move upgrade on testnet:** a member names a delegate agent with an approval cap.
    - The agent may propose, and approve up to its cap. Above the cap, approval aborts onchain, and the
      member approves it themselves.
    - Delegates live in dynamic fields, since an upgrade can't change `Pot`'s layout.
    - Revoking a delegate takes one transaction.
  - **MCP tools:** `pot_status`, `why` (memory), `norms` (what Kitty learned), `propose_spend` and
    `approve`.
    - The agent signs through the same sponsored prepare/execute flow as a wallet (ADR-0064), so the
      server never holds the agent's key.
  - **Web:** "Your agent" on the pot page (delegate, cap, revoke, MCP config), and "approved by Bao's
    agent" on proposals.
- **Reference agents:** each app ships a small LLM agent (OpenRouter, `LLM_SMALL_MODEL`) that uses its
  MCP server, so the exits run a real model's decisions, labelled as an agent's. No human pick, payday or
  approval is invented.

## Consequences
- **Track positioning.** Remora's Track 2 story gets stronger: "any agent gets a leash on chain".
  Receipts stays a Track 1 product, where agents' track records can't be faked. Kitty stays a Track 3
  product, where agents do the pot's chores inside group rules. Entering Tracks 1 and 3 is still open
  (ADR-0060).
- **One contract PR** for MCP tokens and Wake `via`. It needs both approvals (team-split §4).
- **Kitty's upgrade** uses the `UpgradeCap` the spike owner key holds. Testnet only (ADR-0024).
- **Remote MCP adds an attack surface:**
  - tokens are hashed, scoped and rate-limited;
  - tool results from third parties stay untrusted;
  - U9's red-team evals gain MCP attacks.
- **Order.** U12 runs after U11's wrap-up and before U9, so the testnet launch deploys it. One goal
  runs at a time (team-split §7).

## Links
- [ADR-0048](0048-u7-hatchery-learning-memory-runtime.md) (MCP v1), [ADR-0027](0027-flex-takeover.md),
  [ADR-0064](0064-receipts-kitty-web-with-wallets.md), [ADR-0065](0065-split-receipts-and-kitty-repos.md)
- [Goal U12](../goals/uy-12-agents-mcp.md)
