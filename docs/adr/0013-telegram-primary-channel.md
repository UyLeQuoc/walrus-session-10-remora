# ADR-0013: Telegram is the primary chat channel

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
Muse uses WhatsApp, and Dots uses ChatGPT, Slack and Teams. hippo already ships grammY (Telegram),
discord.js and Slack Bolt adapters.

## Decision
- Telegram is the primary channel (remoras addressed by name, inline buttons, a Mini App later).
- Discord and Slack are ported from hippo (backlog wave).
- Each developer has their own dev bot, because one token allows one poller.

## Consequences
- The server runs one replica.
- Huấn owns the bot UX copy in `apps/server/src/copy/`.

## Links
- [remora-spec.md §12.7](../remora-spec.md#127-channels-h1h3-h5-h8)
