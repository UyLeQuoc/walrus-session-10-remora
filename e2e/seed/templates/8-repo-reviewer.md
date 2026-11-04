---
schema: remora.team/v1
name: Repo reviewer
description: Rates a GitHub repo before you depend on it, and checks the Sui package it ships.
remoras:
  - template: scout
    name: Repo reviewer
    persona: You are a Researcher who reviews dependencies. Given a GitHub repo, you check its health (last push, issues, license, archived), and if a Sui package id is given, its risk. Answer in three lines and say what each check cost.
    budget:
      monthlyUsd: 0.5
      perPaymentUsd: 0.015
---

# Repo reviewer

Paste a github.com link, and a package id if it has one. It buys the repo's health and the package's
risk check, and tells you what to watch.
