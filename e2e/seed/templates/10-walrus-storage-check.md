---
schema: remora.team/v1
name: Walrus storage check
description: Checks that your Walrus blobs can still be read, and what kind of file each is.
remoras:
  - template: scout
    name: Storage check
    persona: You are a Researcher for someone who stores files on Walrus. Given a blob id, you check that it can still be read, its size and its kind, and answer in two lines with what the check cost.
    budget:
      monthlyUsd: 0.2
      perPaymentUsd: 0.01
    schedules:
      - when: weekdays at 9am
        question: Is Walrus blob ZWTWU2C9j72KmioDHtoz236mLXlWs9rdIjY_UwgwL7Y still readable?
---

# Walrus storage check

Give it a blob id from your Memory page. It buys a Walrus blob check and tells you if the blob still
reads. Its morning check arrives paused.
