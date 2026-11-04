# ADR-0115: More doors: a Telegram Mini App with no session, and one-click MCP installs

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U17, [ADR-0111](0111-scale-pass.md))

## Context
ADR-0111 asks for more ways to reach a remora:
- Cursor and VS Code, beside the existing `claude mcp add`;
- a Telegram Mini App (H3);
- SuiNS names.

Telegram is already linked to an owner's wallet (A5: the owner signs, and the Telegram user id
becomes a `channel_identities` row). The web app's sessions come from a wallet signature, which a
Telegram webview can't easily give.

## Decision
- **The Mini App** (`/tg`, opened from the bot's menu button):
  - **No session:** every call sends Telegram's signed launch data (`x-telegram-init-data`). The
    server checks the HMAC with the bot token (`verifyInitData`), so it must be fresh for a day. It
    maps the Telegram user to the owner who linked it, and answers for that owner only.
  - **What it does:** it shows the remoras, the last ten receipts and the approvals waiting.
    **Pause all** pauses them in the runtime with no transaction: a paused remora pays nothing.
    Resume restores each one's status.
  - **What it doesn't do:** anything that needs the wallet (approving, pausing onchain, retiring)
    opens the web app.
  - **The menu button:** set by the bot at startup to `<WEB_BASE_URL>/tg`, when that's https.
- **MCP installs:** the Connections page builds three things from the token it just made:
  - an **Add to Cursor** link (`cursor://…/mcp/install`, the config base64-encoded);
  - an **Add to VS Code** link (`vscode:mcp/install?…`);
  - a JSON config for other clients.

  The token sits only in links to a local app. It's never sent to a web page or a server we don't
  run.
- **SuiNS (C3)** gets its own decision when it's built: it needs the SuiNS SDK (a new dependency)
  and a parent name on testnet.

## Consequences
- **Small surface:** the Mini App holds no session or cookie, and can only read and pause.
- **Local runs:** it needs a linked Telegram account and an https web base. A local run proves it
  with signed test launch data (`signInitData`).

## Links
- [ADR-0111](0111-scale-pass.md)
- [ADR-0066](0066-agents-use-the-apps-through-mcp.md)
