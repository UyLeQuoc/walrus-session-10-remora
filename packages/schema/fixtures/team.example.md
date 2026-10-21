---
schema: remora.team/v1
name: Onchain desk
description: A Scout that buys answers and a Sentinel that watches your wallet.
remoras:
  - template: scout
    name: Scout
    model: anthropic/claude-haiku-5.5
    budget:
      monthlyUsd: 0.5
      perPaymentUsd: 0.015
    schedules:
      - when: weekdays at 8am
        question: Is package 0x2 safe to depend on?
  - template: sentinel
    name: Sentinel
    rules:
      - Ignore incoming SUI under 0.01
room:
  name: Team
  responder: auto
  lead: Scout
---

# Onchain desk

Ask Scout anything onchain; tell Sentinel what matters.

- **Scout** buys risk reports, odds and summaries from the Reef, at most 0.015 USDC a call,
  and asks you before anything bigger.
- **Sentinel** watches your address and only pings you for what matters.
