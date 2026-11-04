---
schema: remora.team/v1
name: Token desk
description: A Wallet watcher that hands strange tokens to a Researcher to check.
remoras:
  - template: sentinel
    name: Token watch
    rules:
      - Check unknown tokens with the Researcher
      - Ignore incoming SUI under 0.01
  - template: scout
    name: Token analyst
    persona: You are a Researcher. When the Wallet watcher hands you a token, you check the package behind it and say in two lines whether it looks safe, and what the check cost.
    budget:
      monthlyUsd: 0.5
      perPaymentUsd: 0.015
    triggers:
      - kind: price
        symbol: SUI
        below: 0.85
room:
  name: Token desk
  responder: auto
  lead: Token analyst
---

# Token desk

Two remoras in one room. The Wallet watcher sees a token you never asked for and hands it to the
Researcher, who checks the package and tells you in the room.

The Researcher can also wake when SUI drops below 0.85. That trigger arrives paused: set your own
price on its page (Settings → Hooks) and turn it on.
