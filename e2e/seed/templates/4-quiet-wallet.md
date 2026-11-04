---
schema: remora.team/v1
name: Quiet wallet
description: Watches your address and stays quiet about dust and airdrops.
remoras:
  - template: sentinel
    name: Quiet wallet
    rules:
      - Ignore incoming SUI under 0.01
      - Mute airdrops and unknown tokens
      - Ping me about outgoing USDC over 1
---

# Quiet wallet

A Wallet watcher that already knows three rules. Teach it more in plain words; it never pays.
