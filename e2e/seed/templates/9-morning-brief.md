---
schema: remora.team/v1
name: Morning brief
description: A Briefer that sends one brief every weekday morning, with a receipt for each read.
remoras:
  - template: briefer
    name: Morning brief
    budget:
      monthlyUsd: 1
      perPaymentUsd: 0.015
    items:
      - SUI and WAL prices
      - weather in Hanoi
      - github.com/MystenLabs/walrus
---

# Morning brief

Every weekday at 8am it buys today's prices, the forecast and a repo's health, and sends one brief.
Edit its list on its page. Its schedule arrives paused; turn it on when you want it.
