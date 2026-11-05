# ADR-0134: U19 shows that a remora gets better and lets anyone check it, adds money from a photo and a name, opens more doors, then deploys

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy ("còn feature gì chưa làm bỏ vô goal làm nhiều hơn nữa đi": put the features
  that aren't built yet into a goal and build more), Uy's agent

## Context
U18 is deployed: budget proposals that cite memories, Reef reputation, a weekly review, Seal memory
capsules, starter packs, the Errand, the Keeper, the Splitter, a public page, MPP on every door and
easier steering ([exit](../spikes/2026-11-05-u18-exit.md)). Uy asked for the features still not built,
in one more goal.

What is still not built, from [remora-features.md](../remora-features.md), the README's roadmap and
the U16–U18 exit notes:
- **Learning:**
  - nothing shows, with numbers, that a remora decides better *because of* its memory. Proof of
    Learning (G5) diffs two decisions; nothing replays many;
  - no proactive self-review that proposes rules (D7);
  - no consolidation or conflict check (the W3 half of F11);
  - no import (F7);
  - the index check (F6) can't list what the relayer holds: `listMemories()` arrived in
    `@mysten-incubation/memwal` 0.1.9, and we're on 0.1.8.
- **Proof:** no Merkle anchors for Wakes that didn't pay (G4), no auditor access (G7).
- **Money:**
  - no SuiNS (B5 was cut in ADR-0116 because `@mysten/suins` needs a newer `@mysten/sui`);
  - no images (H2);
  - no Treasurer (C5);
  - the Reef can't be found by x402 indexers.
- **Doors:**
  - no MCP connections (D10);
  - no ratings, author analytics, badge or template updates (M8, M10–M12);
  - no scaffold or publishable packages (J1, J2);
  - no Walrus Site (H6).
- **Production:**
  - six production Discs were revoked by local runs (ADR-0133), so `@uy-researcher` and the U17
    crew are broken;
  - the live gallery still waits for the curated templates;
  - Reef scores say "new" because only one owner shares.

Research done on Nov 5:
- **Walrus Memory TypeScript SDK** ([release notes](https://docs.wal.app/docs/release-notes/walrus-memory)):
  - 0.1.9 adds `listMemories()` and bulk idempotency;
  - 0.1.11 adds `dedupe: true` on remember;
  - 0.1.12 caps recall and auto-save inputs.

  All are inside our `^0.1.8` range.
- **SuiNS:** gRPC `sui.rpc.v2.NameService` has `LookupName` and `ReverseLookupName`. ADR-0116 saw
  `demo.sui` resolve on testnet, so names resolve without `@mysten/suins`.
- **Walrus Sites:**
  - `wal.app` serves mainnet sites only;
  - there is no public testnet portal, so a testnet site is opened through a local portal
    ([docs](https://docs.wal.app/walrus-sites/portal.html)).
- **x402 discovery:**
  - x402 V2's Bazaar is a discovery extension;
  - facilitators serve a catalog at `GET /discovery/resources`, which indexers such as x402scan read
    ([CDP docs](https://docs.cdp.coinbase.com/x402/bazaar.md)).
- **Images:** the turn model (`google/gemini-2.5-flash` through OpenRouter) reads images, so a bill
  from a photo needs no new vendor.
- **MCP:** `packages/mcp` speaks MCP without the SDK. A client for Streamable HTTP (`initialize`,
  `tools/list`, `tools/call`) needs no new dependency either.

## Decision
- **Goal U19** ([spec](../goals/uy-19-it-gets-better.md)) has five parts:
  - **A. It gets better, and shows why:**
    - A0: the Walrus Memory SDK to 0.1.12, with the index check;
    - A1: a replay bench, the same questions with no memory, with memory as of an earlier time and
      with today's memory (G5, L1);
    - A2: rule proposals from outcomes (D7);
    - A3: tidy, which consolidates notes and asks about conflicts (F11);
    - A4: import (F7).
  - **B. Anyone can check it:** auditor access through the capsule policy (G7), and Merkle anchors
    for Wakes that didn't pay (G4).
  - **C. Money people use:** pay a `.sui` name (B5), a bill from a photo (H2), the Treasurer (C5),
    and x402 discovery for the Reef.
  - **D. More doors:**
    - MCP connections (D10);
    - ratings, author analytics and a badge (M10–M12);
    - template updates (M8);
    - `create-remora` and publishable packages (J1, J2);
    - a Walrus Site on testnet (H6).
  - **E. Ship it:**
    - the production cleanup and real Reef scores;
    - the landing, the docs and the PR;
    - the **deploy**.
- **The order:** if time runs short, the spec's order holds. It starts with A1, A2, C2, C1 and B1,
  because they carry the story and both prizes.
- **A rule can only narrow spending.** A rule a remora proposes can only make it skip, ask or
  ping, so the owner accepts it with a tap. Anything that could spend more is a budget proposal,
  and it needs a signature as before.
- **A replay never pays and never writes memory.** It runs the planner in shadow mode, and every
  replay number is labeled as a plan, not a purchase.
- **Auditor access reuses `remora_capsule`** with the auditor's wallet as the grantee, so it needs no
  Move change.
- **Anchors are a new testnet package** (`remora_anchor`). The deployed `remora` package isn't
  upgraded.
- **Names are resolved over gRPC**, and the contact keeps the address it was signed for (ADR-0109).
  Paying needs no `@mysten/suins`. Registering subnames stays on Uy's list (ADR-0116).
- **A third test owner** (`E2E_BURNER3_KEY`, local `.env` only) joins the burner and burner2, so the
  Reef reaches its 3-owner floor with real counts. It's funded from the burner.
- **Out of U19,** for Uy:
  - the mainnet pass and owned memory, a delegate per remora on the owner's own Walrus Memory account
    (U10, ADR-0024, ADR-0030);
  - npm publishing;
  - a mainnet Walrus Site and SuiNS subnames.
- **No schema push.** New data lives in existing columns:
  - rules, MCP connections and the Treasurer's watch list in the remora's config;
  - ratings and template updates in `remora_events`;
  - anchors in `remora_events` and on Sui.
- **Deploying is part of the goal,** as in U17 and U18. Running the goal is Uy's approval for one
  deploy of U19's merge to main, following docs/deploy.md, plus the testnet publish of
  `remora_anchor`. To keep the deploy off, Uy deletes that line from the prompt before running it.

## Consequences
- **Easier:**
  - the submission can lead Best Walrus Memory with a measured before and after: the same questions,
    planned with no memory, with older memory and with today's, where each change cites a memory;
  - an auditor can check a remora's Wakes without an account, and the Wakes that didn't pay can be
    proven too;
  - the Reef shows real scores.
- **Harder:**
  - sixteen parts in three days;
  - the cut order and the 18:00 freeze on Nov 7 matter;
  - Remora gets broader, while the judges favor one story ([ADR-0081](0081-launch-story.md)). The
    landing and the video lead with A1's replay, and the rest stays in the README.
- **Docs to update during the goal:**
  - the README's "what's real" and its roadmap (which still lists U18's parts);
  - `docs/economy.md`;
  - the submission draft and the blog draft;
  - `docs/remora-features.md`;
  - the goals README;
  - the U19 exit note.

## Links
- [Goal U19](../goals/uy-19-it-gets-better.md) and its
  [prompt](../goals/uy-19-it-gets-better.prompt.txt).
- [ADR-0119](0119-u18-learning-loop-everyday-money.md) (U18), [ADR-0130](0130-memory-capsules-seal.md),
  [ADR-0133](0133-local-e2e-keeps-production-discs.md), [ADR-0116](0116-suins-names-cut-from-u17.md),
  [ADR-0109](0109-pay-only-at-listed-address.md), [ADR-0110](0110-live-attack-bait-and-switch.md),
  [ADR-0074](0074-memory-facts-and-admission.md), [ADR-0030](0030-w2-memory-mode.md),
  [ADR-0024](0024-testnet-first.md) and [ADR-0107](0107-u16-without-handoffs.md).
