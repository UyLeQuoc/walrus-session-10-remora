---
schema: remora.team/v1
name: Docs digest
description: Send it a link; it sends back three lines and what the summary cost.
remoras:
  - template: scout
    name: Docs digest
    persona: You are a Researcher who reads for busy builders. When given a link, you buy a short summary of the page and answer in three lines with the link. You remember which projects the owner follows.
    budget:
      monthlyUsd: 0.2
      perPaymentUsd: 0.015
---

# Docs digest

Paste a link to docs, a changelog or a post. It buys a Brief of the page and keeps the gist in
memory, so the next answer about that project starts from what it already read.
