# ADR-0111: U17 scales Remora (an open Reef, crews, more doors, numbers under load), then deploys

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Uy (asked "scale remora hơn nữa", then chose every direction and the deploy), Uy's agent

## Context
After U16 a remora does many jobs, but all of them follow one pattern: one owner's remora buys from
eight services that we run. Uy asked to scale Remora further. Asked how, Uy chose all four
directions:
- an open economy;
- crews of remoras;
- more channels;
- proof under load.

Uy also chose to deploy to production at the end. Production still runs the Nov 3 build.

The code already has some of the parts:
- `applyTeam` creates a whole team with one owner signature.
- The `handoff` tool asks another of the owner's remoras a question.
- `buildSetPayees` exists in disc-sdk, though nothing calls it yet.
- The facilitator and its gas pool serve our own merchants.
- `@mysten/sui` 2.36 has the gRPC `NameService.LookupName`.

These are missing:
- remora-as-merchant (E11);
- listing your own API (E8);
- the public facilitator (E13);
- the Telegram Mini App (H3);
- SuiNS names (B5);
- any load numbers.

## Decision
- **Goal U17** ([spec](../goals/uy-17-scale.md)) has five parts:
  - **A. An open Reef:**
    - a remora can sell its answers over x402 at its owner's address;
    - an owner can list their own x402 API after a probe;
    - the facilitator is documented for any Sui x402 merchant on testnet, with rate limits and a
      gas cap.
  - **B. Crews:** a team plus a lead. The lead splits a question across its members, each member
    pays from its own Disc, and one answer cites every receipt.
  - **C. More doors:**
    - one-click MCP configs (Cursor, VS Code, JSON);
    - a Telegram Mini App;
    - SuiNS subnames on testnet, resolved over gRPC.
  - **D. Numbers under load:** a dated run of 1,000 or more paid calls with the model out of the
    loop. Every Disc's spend is read back onchain, and there must be zero overspends. A public
    `/stats` page shows the result.
  - **E. Ship it:** the landing page, the docs, the PR, then the **deploy**.
- **A sold answer settles after the work.** `@remora/merchant`'s x402 gets a `settle: "after"` mode
  (verify, then the handler, then settle only on a 2xx), so a failed answer costs the buyer nothing.
  The house merchants keep settle-first with their source read first (ADR-0106).
- **Loops can't happen.** A remora can't buy from itself, and a sold answer can't buy another
  remora's answer (depth 1). A sold answer doesn't write the buyer's question into the seller's
  memory.
- **No schema push.** New data lives in existing JSON columns (a remora's config) unless an ADR
  shows that's impossible. In that case the deploy waits, and the push goes on Uy's list
  (docs/deploy.md step 2).
- **The deploy is approved once,** for U17's merge to main. It follows docs/deploy.md: diagnose,
  `railway up`, `vercel deploy`, a health check and the main e2e on the live site.
  - `DEMO_ATTACK` stays unset.
  - A failed check rolls the deploy back.
  - Later deploys need Uy's yes again.
- **Who does it:** Uy's agent does every part, the way U16 ran ([ADR-0107](0107-u16-without-handoffs.md)).
- **If time runs short,** keep this order:
  1. remora-as-merchant and the public facilitator;
  2. the load run;
  3. crews;
  4. MCP links;
  5. the Mini App;
  6. listing your own API;
  7. SuiNS.

  Whatever is cut goes on the list for Uy.

## Consequences
- **The pitch** for Best Use of Agent Payments ([ADR-0084](0084-enter-best-use-of-agent-payments.md))
  becomes "agents pay agents, under limits Sui enforces". It no longer depends only on our own demo
  merchants.
- **Two test owners:** the second one is a new testnet key (`E2E_BURNER2_KEY`, local only), funded
  from the burner.
- **The load numbers** measure the payment rails, not the model. They're labeled that way
  everywhere.
- **Docs to update:** the README's "what's real", the landing page, the submission draft,
  `apps/facilitator/README.md`, `apps/merchants/README.md`, the goals README and the exit note.

## Links
- [Goal U17](../goals/uy-17-scale.md)
- [ADR-0106](0106-wow-pass-more-uses.md)
- [ADR-0107](0107-u16-without-handoffs.md)
- [ADR-0109](0109-pay-only-at-listed-address.md)
- [ADR-0099](0099-first-deploy-one-railway-service.md)
- [docs/deploy.md](../deploy.md)
