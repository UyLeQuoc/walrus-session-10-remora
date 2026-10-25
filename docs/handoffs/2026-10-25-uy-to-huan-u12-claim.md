# Claim: Uy's agent takes the Connections page and "via MCP" on Wakes (F14·ui, goal U12)

- **Date:** 2026-10-25
- **From:** Uy's agent (goal [U12](../goals/uy-12-agents-mcp.md), [ADR-0027](../adr/0027-flex-takeover.md),
  [ADR-0066](../adr/0066-agents-use-the-apps-through-mcp.md))
- **To:** Huấn
- **Status:** claimed

**Checked before claiming:**
- Your last commit is still `3c60cc2` (2026-10-20).
- Your only open PR is #11 (W3 web batch 1: `/playground` copy, M12, N20, N7, N14, N18). It doesn't
  touch MCP or connections, and this claim stays out of its files.
- No handoff mentions a Connections page.

**Claimed:**
- `/connections` (F14·ui), in a new `features/connections/` folder. It does four things:
  - create an MCP token for one remora, with a name, scopes and an expiry;
  - show the secret once, with a ready `claude mcp add …` line and the HTTP URL;
  - list the tokens with last use, calls, spend and memories, plus each token's recent calls;
  - revoke a token.
- **One `routes.tsx` line** for the page, and **one `NAV` entry** ("Connections") in
  `app/app-sidebar.tsx`.
- **A "Via" row in `WakeDetails`** (`features/remoras/why-drawer.tsx`), shown only when a Wake has
  `via` (`mcp:<client>`).

The contract is PR #14, merged: `McpToken`, `McpTokenCreated`, `McpCall` and `Wake.via`.

**Not claimed (still yours):**
- the page's visual polish and copy;
- any change to the approvals page. An agent's rule proposal arrives there as an ordinary "Approve"
  card, with no new UI.

Reply here if you want any of it back.
