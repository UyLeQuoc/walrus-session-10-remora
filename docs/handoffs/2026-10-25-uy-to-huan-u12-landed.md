# Landed: MCP v2 (F14): agents use a remora through MCP, plus the Connections page (goal U12)

- **Date:** 2026-10-25
- **From:** Uy's agent (goal [U12](../goals/uy-12-agents-mcp.md), [ADR-0066](../adr/0066-agents-use-the-apps-through-mcp.md),
  [ADR-0067](../adr/0067-mcp-v2-details.md))
- **To:** Huấn
- **Status:** landed on `main`; the claim was [2026-10-25-uy-to-huan-u12-claim.md](2026-10-25-uy-to-huan-u12-claim.md)

## What landed in your lane
- **The contract (PR #14, merged):** `McpScope`, `McpToken` (never the secret), `McpTokenCreated` (the
  secret once), `McpCall`, and an optional `Wake.via`. Each has a fixture in `packages/schema/fixtures/mcp.*`
  and `wake.mcp-payment.json`.
- **`/connections`** (`features/connections/`):
  - make a token: name, remora, permissions, expiry;
  - the secret shows once, with two ready Claude Code lines (HTTP, and stdio from a clone);
  - each token's calls, spend, memories and recent calls, with links to their Wakes;
  - revoke, behind `ConfirmAction`.

  It's built from your kit and page components (ADR-0036). Tests: `connections-page.test.tsx` (3).
- **One `routes.tsx` line** and **one `NAV` entry** ("Connections", the `Cable` icon) in
  `app/app-sidebar.tsx`.
- **A "Via" row in `WakeDetails`**, shown only when a Wake has `via`: "MCP: http-script".
- **E2E:** `e2e/tests/u12.spec.ts`, with a `u12` project and `API_BASE_URL` added to the local server's
  env in `playwright.config.ts`. It's opt-in like `w2`.
- **Not touched:** the approvals page. An agent's rule proposal (kind `rule`) and its
  `approval_request` (an `over_limit_payment`) show up there as ordinary cards.

Polish and copy on the page are yours, if you want them.

## The exit on testnet (Oct 25, 03:26–03:36 UTC; owner: the E2E burner)
The setup: Scout `Scout u12 mvn9mtt4` (`51faf79c-8068-4047-b95f-c3b4aae7b19c`), issued in `6DxDvhaC…`,
with a 0.015 USDC per-payment cap. Three tokens were made on the Connections page:
- "Claude Code": all scopes, used over stdio;
- "HTTP script": all scopes;
- "Read only": `memory:read`.

| Step | Result |
|---|---|
| A stdio client (`packages/mcp` proxying to `/mcp`) and an HTTP client, each with its own token | ✅ `initialize`. The stdio client's `tools/list` shows `pay` etc. for its scopes |
| **Real Claude Code** (`claude -p` with `--mcp-config`) uses the stdio server | ✅ it called `remoras_list` on the "Claude Code" token (03:27:16, in the call log) |
| `remora_remember` writes an episode, the blob lands, then `remora_recall` finds it | ✅ blob `Yb9ZNt1rzqM0Av_NbwZ6Cno-5YUCwhSOPNNrN7ymWZw` in `me`, settled 18 s after the write, recalled at 22 s; tagged `[by:@mcp:claude-code]` |
| `pay` buys `sui-risk` inside the Disc; the Wake says `via` and verifies | ✅ `2UGiVjrJJbgVq8aCmN6boapon8swQyYvheaG13mpGT67`, 0.01 USDC, Wake `38f27053…`, `via mcp:http-script`, anchored. All 6 verify checks pass (screenshot `u12-verify-via.png`) |
| `pay` for `odds` (0.02) over the 0.015 cap | ✅ refused before signing: Sonar against the live Disc's cap says "ask", and `over_limit` comes back with Wake `361a94f3…`. Nothing moved |
| `approval_request` asks the owner, who pays once in the web | ✅ approval `5ff64ee4…` (`via mcp:http-script`), paid in `/approvals` with the burner: `8Godpf8ieWArfoXfEWRwgQemTjVWrhCPjG45pV6wpAvz`. `approval_request {approvalId}` then says `approved` |
| A read-only token calls `pay` | ✅ HTTP 403, logged as "missing scope pay" |
| A token is revoked in the web | ✅ its next call is 401: −32001 over stdio, and HTTP 401 |
| The Connections page shows the calls and the spend | ✅ "HTTP script": 6 calls, 0.01 USDC, its recent calls with Wake links. Desktop and 375 px, light and dark, no horizontal scroll (`e2e/screenshots/u12-connections-*.png`) |

**How it ran.** The spec ran once, and then only the failed steps again after their fixes:
1. **The first run** passed every step through the revoke. It then failed on the spec's own locator: two
   elements said "revoked". Fixed.
2. **Resume 1** re-ran the revoke check with a fresh token, and both 401s passed. It then failed at the
   375 px dark screenshot: the server's per-IP limiter had counted the owner's own token-list reads.
   **Fixed in `iplimit.ts`:** they're unmetered, like the other W2 reads.
3. **Resume 2** retook the screenshots, then failed to retire the Scout. The e2e global setup had already
   revoked its Disc, so the UI's revoke couldn't find it. **Fixed in `retireTx`:** a Disc that's already
   gone means retire with nothing to sign. Tested.
4. **Resume 3** retired the Scout.
5. **Resume 4** retook the screenshots after a UI fix: the expiry showed "just now", because `Time` only
   reads the past. The Connections page now shows the expiry date.

**Evals.** `evals/mcp-attacks.json` holds 10 attacks: no scope, revoked, expired, a non-Reef payee, an
injected URL, over the Disc, another remora's memory, a rule written directly, a redirected `payTo`, and a
foreign `Origin`. All 10 are stopped and 0 paid, in CI (`apps/server/src/mcp/attacks.test.ts`).
