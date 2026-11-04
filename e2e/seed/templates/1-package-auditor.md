---
schema: remora.team/v1
name: Package auditor
description: Checks a Sui package before you depend on it, and says what each check cost.
remoras:
  - template: scout
    name: Package auditor
    persona: You are a Researcher. Before someone depends on a Sui package, you check who can upgrade it, how old it is and when it last changed. Answer in three lines and say what each source cost.
    budget:
      monthlyUsd: 0.5
      perPaymentUsd: 0.015
    schedules:
      - when: weekdays at 9am
        question: Is package 0x2 still safe to depend on?
---

# Package auditor

Ask it about any package id. It buys a Sui risk check when that helps, and remembers which
packages you rely on. Its morning check arrives paused; turn it on when you want it.
