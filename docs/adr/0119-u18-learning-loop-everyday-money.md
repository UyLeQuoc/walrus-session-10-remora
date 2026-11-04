# ADR-0119: U18 adds a learning loop you can see, everyday money and a remora anyone can use, then deploys

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy ("soạn feature thêm cho remora đi, nhiều để tôi bỏ vô goal, research rồi làm đủ
  luôn": draft many more features as one goal, researched, and build all of them), Uy's agent

## Context
U17 is deployed. Remora is now a network: remoras sell to remoras, anyone can list an API, crews
exist, and a dated load run made 1,000 paid calls. Uy asked for many more features in one goal.

What the judges reward:
- **Best Walrus Memory** goes to "the deepest learning loop" ([event rules](../event-rules.md)).
- **The Mystery Bounty** is Best Use of Agent Payments: x402 or MPP payments settled on Sui.
- **Session 8** went to a simple product with one relatable story and a before/after
  ([ADR-0081](0081-launch-story.md)).

What the code has:
- **Learning:**
  - proof of learning (`learning.ts`), memory facts and admission (ADR-0074), thumbs feedback,
    `source_stats` and approvals;
  - nothing proposes a budget, scores the Reef from outcomes or writes a weekly review.
- **Seal:** it only decrypts the owner's own Walrus Memory blobs. No Move policy shares memories.
- **Payments:**
  - every paid door speaks x402 only;
  - a visitor without an account can't buy an answer;
  - remoras pay only services, never people.
- **Triggers:** `Trigger` already has the `price` and `webhook` kinds, but the runtime handles
  neither.

Research done on Nov 5:
- **MPP** is the Payment HTTP auth scheme
  ([draft-httpauth-payment-01](https://paymentauth.org/draft-httpauth-payment-01.txt)):
  - the 402 carries `WWW-Authenticate: Payment` with `id`, `realm`, `method`, `intent` and a
    base64url JCS `request`;
  - the retry carries `Authorization: Payment`;
  - success carries `Payment-Receipt`.
- **MPP on Sui:** `@suimpp/mpp` (MIT, 0.9.0) is a community `sui` charge method on top of `mppx`.
  sui.io/agentpayments advertises agent payments on Sui.
- **Walrus Memory** documents sharing an agent's knowledge with another agent through delegates. A
  Seal policy in our own package can grant a subset of memories, with an expiry and a revoke, without
  touching the owner's MemWal account.

## Decision
- **Goal U18** ([spec](../goals/uy-18-learning-loop.md)) has four parts:
  - **A. A learning loop you can see:**
    - budget proposals that cite memories (E5);
    - Reef reputation from opt-in outcomes (E10);
    - a weekly review written back to memory (F10);
    - memory capsules: lend memories to another owner's remora through Seal, and revoke them (F13);
    - starter memory packs (M2).
  - **B. Everyday money:**
    - Errand pays people (C3);
    - Subscriptions Keeper flags price hikes it remembers (C4);
    - Splitter (C9);
    - a public page where anyone buys one answer from their own wallet (M9);
    - MPP on every paid door (E12);
    - statements and CSV (E6).
  - **C. Easier to start and to steer:**
    - describe the job in plain words (B2);
    - chat commands (N9);
    - config history (N11);
    - the `price` and `webhook` triggers (D1);
    - outbound webhooks (J3).
  - **D. Ship it:** the landing page, the docs, the PR, then the **deploy**.
- **The order:** if time runs short, the spec's order holds. It starts with A1, B4, B1, A2 and B5,
  because they carry the story and both prizes.
- **Signatures:** proposals, chat commands and config restores only prepare transactions. Every money
  change still needs the owner's signature.
- **Capsules are a new Move module** (`capsule` with `seal_approve`), published to testnet only
  (ADR-0024). The grantee decrypts at answer time and never copies the plaintext, so a revoke takes
  effect on the next turn. If Seal or Walrus testnet block it for 3 hours, it's cut with an ADR.
- **MPP is written in `@remora/merchant`** against the draft, matching `@suimpp/mpp`'s `sui` method
  shape. Adding that package, even only for an interop test, needs its own ADR.
- **No schema push.** New data lives in existing columns: proposals in `approvals.payload`, opt-ins
  and contacts in the remora's config, versions in `remora_events`. Webhook secrets are derived, not
  stored.
- **Deploying is part of the goal,** as in U17. Running the goal is Uy's approval for one deploy of
  U18's merge to main, following docs/deploy.md. To keep the deploy off, Uy deletes that line from
  the prompt before running it.

## Consequences
- **Easier:**
  - the submission can show the loop end to end, as act, outcome, memory, proposal, signature and
    remembered outcome, with dated receipts;
  - judges without an account can pay a remora from their own wallet;
  - MPP clients can pay any of our doors.
- **Harder:**
  - many parts in three days;
  - the cut order and the 18:00 freeze on Nov 7 matter;
  - the capsule part depends on Seal key servers and the Walrus testnet publisher.
- **Docs to update during the goal:**
  - the README's "what's real";
  - `docs/economy.md`;
  - the submission draft;
  - `docs/remora-features.md`;
  - the goals README;
  - the U18 exit note.

## Links
- [Goal U18](../goals/uy-18-learning-loop.md) and its
  [prompt](../goals/uy-18-learning-loop.prompt.txt).
- [ADR-0111](0111-scale-pass.md) (U17), [ADR-0109](0109-pay-only-at-listed-address.md),
  [ADR-0110](0110-live-attack-bait-and-switch.md), [ADR-0074](0074-memory-facts-and-admission.md),
  [ADR-0024](0024-testnet-first.md) and [ADR-0107](0107-u16-without-handoffs.md).
