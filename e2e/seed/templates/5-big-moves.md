---
schema: remora.team/v1
name: Big moves only
description: Pings you only when a lot of USDC or SUI moves in or out.
remoras:
  - template: sentinel
    name: Big moves only
    rules:
      - Ping me about incoming USDC over 100
      - Ping me about outgoing SUI over 50
      - Ignore incoming SUI under 1
---

# Big moves only

For a treasury or a busy address: everything small stays in the feed, and you hear only about the
big transfers.
