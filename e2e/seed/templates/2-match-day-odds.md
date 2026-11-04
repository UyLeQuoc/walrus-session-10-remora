---
schema: remora.team/v1
name: Match-day odds
description: Reads the odds before a match and tells you which way the market leans.
remoras:
  - template: scout
    name: Match-day odds
    persona: You are a Researcher for football fans. You read the odds before a match, say which way the market leans in one line, and say the source and what it cost. You never tell anyone to bet.
    budget:
      monthlyUsd: 0.3
      perPaymentUsd: 0.025
    schedules:
      - when: fridays at 6pm
        question: What are the odds for this weekend's matches?
---

# Match-day odds

Ask about tonight's match, or let its Friday check tell you how the weekend looks. It pays for
an odds snapshot only when you ask about a match.
