# ADR-0148: The Treasurer watches a team's wallets, reports the runway, and turns requests into payments only the owner signs

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
- U19 C3 (C5 in remora-features.md) asks for a Treasurer. It watches up to 10 team addresses. It
  writes a weekly treasury report, also on demand: what came in and went out, the top
  counterparties, and the runway at the current burn. The report can be shared as a public,
  redacted link. It turns spend requests from the owner's chat, Telegram or a signed inbound
  webhook into payments only the owner signs.
- The pieces exist:
  - the chain watcher (`triggers/watch.ts`, ADR-0058) streams `SubscribeCheckpoints` per network,
    filtered to the addresses Sentinels watch;
  - the weekly review job (ADR-0128);
  - approvals that the owner pays from their own wallet (`approvalPayTx`/`approvalPay`, with the
    contact path from ADR-0125);
  - signed inbound webhooks (ADR-0121);
  - `.sui` names over gRPC (ADR-0144);
  - G6 share tokens (ADR-0076).
- gRPC has no address-history query, so history has to be indexed from the stream (ADR-0021).

## Decision
- **A sixth kind, `treasurer`** ("Treasurer").
  - **It holds no Disc and never pays.** Every request becomes an approval, the owner's own
    included. The owner pays it from their own wallet through `approvalPay`'s contact path, a plain
    transfer of the owner's address balance to the contact's address. Nothing the Treasurer reads
    can move money.
  - It's created by `POST /api/treasury`. That route resolves names first, so a bad one leaves
    nothing behind. There's no transaction to sign.
  - Its setup is one config version:
    - `config.treasury`, a new optional field in `RemoraConfig` with no schema push, holding the
      `watch` list (address, label, and the `.sui` name each was added by with when it was
      resolved), `perRequestCap` (default 1 USDC) and `monthlyCap` (default 10 USDC);
    - `config.contacts`, the Errand's shape;
    - a `chain` trigger with the same addresses.
- **One set of streams.** `watchedOn` now includes Treasurers beside Sentinels. The runtime routes
  each event by kind: a Treasurer keeps it, a Sentinel triages it. `eventsFrom` can also name the
  counterparty, the largest opposite change of the same coin in the transaction.
  - A Treasurer stores each balance change as an `episode` with `flow: true`, deduplicated by
    digest, address and coin, so a backfill doesn't count a change twice.
- **The report** covers 7 days and is computed from those flows, with balances read now over gRPC
  (`getBalance`):
  - per coin, the team is treated as one wallet:
    - `in` is what came from outside;
    - `out` is what went outside, gas included;
    - `internal` is what moved between watched addresses;
    - runway = balance ÷ (out ÷ days), or none when nothing went out;
  - per address, its in and out;
  - the top 5 counterparties by transfers, then by volume, with a team address named as one;
  - the plain lines come from the numbers only. No model writes them.
  - The report uses the review's job, Monday 09:00 in the owner's timezone, queued when the
    Treasurer is created. It's stored as a `review` event marked `treasury: true`, written to
    memory (`episodes`) and sent to the owner. "Report now" allows 3 an hour.
- **Sharing follows G6:** a random token in the report's payload is served at `/t/:token`
  (`GET /api/public/treasury/:token`).
  - The page shows an allow-list: the period, totals and runway per coin, each address by its label
    and a shortened address, and the counterparties shortened.
  - It never shows full addresses, `.sui` names, per-address balances, requests, memos or the owner.
  - Revoking clears the token.
- **Spend requests** come from three places:
  - the owner's web ask (`/ask` or the card);
  - Telegram ("Treasurer, pay …");
  - a webhook on U18's signed door (ADR-0121), so the HMAC is required. The body is
    `{"text": …}`, `{"to", "amount", "memo"}` or plain text.

  The text is data:
  - it's read only by a fixed grammar (`parseSpendRequest`), never by a model, so it can't add a
    contact, change a limit or pay;
  - the payee must be a contact, by name, by the `.sui` name it was added by, or by address;
  - a contact added by name is checked again over gRPC, and a moved name is declined (ADR-0144);
  - the amount must fit `perRequestCap`;
  - this month's pending and paid requests plus this one must fit `monthlyCap`.

  A request that passes becomes an `over_limit_payment` approval with `treasurer: true`. It carries
  the payee, `payTo`, the amount, the memo, where the request came from and the list of checks. It
  isn't `viaDisc`, so "Approve" can't pay it; only the owner's signature can. A request that fails is
  declined with the reason: a `blocked` event, and a notice when it came from outside.
- **Web:**
  - Treasurer is in the template catalog and the create form (team addresses as "label 0x…" or
    "name.sui", contacts, the two limits);
  - its card shows the watched addresses with their names, the last report with Share, and the
    pending requests with their checks, "Pay from my wallet" and Decline;
  - Settings → Hooks offers it webhooks, not price triggers.
- **A fix found on the way:** `ApprovalPayTx.requirements` is now nullable. The contact path has
  always returned `null` there, so the web couldn't pay any contact approval, an Errand's or a
  Treasurer's, from the owner's wallet.

## Consequences
- Easier:
  - a team sees its in, out, counterparties and runway from Sui itself, and can share it without
    exposing addresses;
  - an invoicing tool can ask for money without being able to move any.
- Harder:
  - a Treasurer's contacts aren't Disc payees, so adding one needs no signature. That's safe only
    because every payment is the owner's own signed transfer to the address shown on the card.
- Limits:
  - flows count from when the Treasurer starts watching, since the stream has no history;
  - balances are read for SUI, USDC and any coin seen in the flows;
  - the burn is a 7-day average.
- Docs: the U19 spec's C3, the goals README and the feature list's C5 should point here.

## Links
- ADR-0021, ADR-0058, ADR-0076, ADR-0109, ADR-0121, ADR-0125, ADR-0128, ADR-0134, ADR-0144;
  [U19 spec, C3](../goals/uy-19-it-gets-better.md).
