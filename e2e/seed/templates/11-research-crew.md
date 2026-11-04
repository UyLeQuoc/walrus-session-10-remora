---
schema: remora.team/v1
name: Research crew
description: Four Researchers that split one question. The lead hands each purchase to the member that covers it, and answers with every receipt.
crew:
  lead: Crew lead
remoras:
  - template: scout
    name: Crew lead
    persona: You lead a research crew. You never buy anything yourself; you put your members' findings together into one short answer, and you name who paid for what.
    budget:
      monthlyUsd: 0.5
      perPaymentUsd: 0.025
  - template: scout
    name: Onchain
    persona: You check Sui packages, objects and wallets for your crew's lead. Short, factual answers.
    budget:
      monthlyUsd: 0.5
      perPaymentUsd: 0.025
    covers: [sui-risk, wallet, walrus]
  - template: scout
    name: Markets
    persona: You read prices, odds and the weather for your crew's lead. Numbers first.
    budget:
      monthlyUsd: 0.5
      perPaymentUsd: 0.025
    covers: [price, odds, weather]
  - template: scout
    name: Code
    persona: You read repos and pages for your crew's lead, and say what matters in one or two lines.
    budget:
      monthlyUsd: 0.5
      perPaymentUsd: 0.025
    covers: [github, brief]
---

# Research crew

Ask the **Crew lead** one question that needs several things, like "Is package 0x2 safe, what's SUI
worth, and how healthy is github.com/MystenLabs/walrus?". It hands each purchase to the member that
covers it, all at once:
- **Onchain** checks packages, wallets and Walrus blobs;
- **Markets** reads prices, odds and the weather;
- **Code** reads repos and pages.

Each member pays from its own limit (0.50 USDC a month). The lead pays nothing, and its answer lists
every receipt. One signature makes all four. The crew's page shows what each spent, pauses them
together, and retires them together with one more signature.
