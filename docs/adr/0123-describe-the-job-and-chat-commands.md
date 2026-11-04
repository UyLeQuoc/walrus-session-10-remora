# ADR-0123: Describe the job, and change settings from chat with a card you tap or sign

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 C1, C2)

## Context
Goal U18 ([ADR-0119](0119-u18-learning-loop-everyday-money.md)) part C asks for two ways to steer a
remora in words:
- **C1 (B2), describe the job:** one box on New remora, "What should it do?". A model drafts the
  remora; the draft is checked and repaired once; the owner reviews every field and hatches with the
  usual one signature.
- **C2 (N9), chat commands:** "raise Researcher's monthly limit to 1 USDC", "pause Sentinel at
  night", "add Linh 0x… as a contact", "sell Researcher's answers for 0.02", from web chat and
  Telegram. Nothing that moves money or changes a limit runs without the owner's signature.

What the code already has:
- **Creating:** `POST /api/remoras` takes a kind, a name, a budget, watched addresses (Wallet
  watcher) and a list (Briefer). The kind fixes the tools and the triggers. `issueArgs` always issues
  a monthly rate limit.
- **After creating:** `PATCH /api/remoras/:id` (name, persona), schedules (`addSchedule`, Researchers
  and Briefers only) and `teach` (Wallet watcher rules).
- **Money changes:** `budgetTx`/`confirmBudget` (revoke and reissue), `pauseTx`/`syncStatus` (a
  Disc's pause), `payeesTx`/`confirmPayees`. A Disc-less remora pauses with `setPaused`. The wallet
  signs on the web (`useSignAndRun`, gRPC).
- **Other settings:** `setSale` (E11) and the owner's quiet hours (`owner_settings`). Nothing pauses
  one remora on a schedule.
- **Telegram:** inline buttons carry a URL or callback data (`keyboardOf`, at most 64 bytes); the bot
  acts only for the wallet a chat linked (A5).
- **The feed's types are a shared contract;** a sale is already an `action` with `kind: "sale"`.

## Decision
- **One small parse model for both** (`LLM_SMALL_MODEL`), behind a port (`steerModel`) so tests use a
  fake. Its outputs are flat objects with nullable fields, which every provider's structured output
  can carry, then parsed with zod into the typed shapes below.
- **C1: `POST /api/remoras/draft {text}`** → `{ok: true, draft, issues}` or `{ok: false, refused}`
  (`RemoraDraft`, `DraftResponse` in `packages/schema/src/steer.ts`).
  - **Refusals:** trading or swapping coins and moving the owner's own funds are refused by pattern,
    in English and Vietnamese, before any model call. The model refuses the rest (anything no kind's
    tools can do).
  - **The model sees the live lists:** the kinds from `service.templates()` and the Reef for the
    session's network, so kinds other U18 parts add (Errand, Keeper) are offered without a change
    here.
  - **Checks:** the kind exists; the tools are real (`TOOL_NAMES`) and the kind's own; payees are
    listed on the live Reef; the schedule parses (`previewSchedule`) and the kind answers on one;
    addresses are Sui addresses; a kind that never pays has no budget; amounts are positive and the
    per-payment cap is within the monthly limit.
  - **Repair once, then hand over:** the errors go back to the model once. Whatever is still wrong
    becomes an issue, and its field falls back to the kind's default or empty, so the form opens
    with the rest filled.
  - **The draft fills the existing form;** the picker path stays as it was. What the form never had
    (a persona, a schedule, a watcher's rules) is applied after the hatch by
    `POST /api/remoras/:id/setup`, through `edit`, `addSchedule` (a Briefer's brief schedule is
    replaced when the time differs) and `teach`. What one of them refuses is reported, not thrown.
  - **Fixed by the kind, not drafted:** tools (create always uses the kind's), and the budget window
    (always monthly, as the Disc issues it).
- **C2: a cheap prefilter, then a typed command.** Lines that read like a settings change (a few
  English and Vietnamese patterns) go to the model; everything else goes on as a message with no
  model call. `ChatCommand` is a zod discriminated union: `limit`, `pause`, `resume`, `quiet`,
  `rename`, `persona`, `sell`, `contact`.
  - **Which remora:** the owner's own remoras only, matched by name, then kind ("Researcher"), then
    part of a name. None found, or more than one, asks which.
  - **The change card** is an `action` event with `kind: "change"` (feed types unchanged), holding the
    target, the diff before → after, whether it needs a signature, a 24-hour expiry and a fingerprint
    of the settings it was planned against. A card whose settings changed since expires instead of
    applying. In a 1-1 thread the card sits in that thread and names its target.
  - **Settings that move no money apply on a tap:** rename, persona, a Disc-less pause or resume, the
    sale's price and on/off, and quiet hours. Web: Apply. Telegram: an inline button
    (`chg:<id>:a`, Cancel is `chg:<id>:x`).
  - **Limits, a Disc's pause or resume, and contacts are signed.** The card carries a sign link,
    `/changes/:id` on the web. Opening it builds the transaction then, from the remora as it is
    (`budgetTx`, `pauseTx`, or B1's contacts transaction). The wallet signs and executes it, and the
    same service confirms the pages use (`confirmBudget`, `syncStatus`, B1's confirm) read the chain.
    No tap applies a signed card.
  - **"Pause … at night" sets the owner's quiet hours** (22:00–07:00 unless the line says otherwise),
    the one home that exists. The card says it applies to every remora and that a remora can't pause
    on a schedule yet.
  - **Contacts are an optional dependency** (`contactsTx`, `confirmContacts` on the steer deps) until
    U18 B1 wires them. Until then the reply is "Contacts aren't available yet."
  - **Untrusted lines only propose.** Every step (view, apply, decline, transaction, confirm)
    checks that the card's remora and its target belong to the signed-in owner. In Telegram only the
    chat's linked wallet can propose or tap, so another member of a group can't apply someone
    else's card.
- **Where it lives:**
  - `apps/server/src/runtime/{draft,commands,steer,steer-routes}.ts`, mounted in the remora routes
    after the wallet check and before the id check, since `draft` isn't an id;
  - small hooks in `threads.ts` (`postMessage`), `rooms.ts` (`postToRoom`) and `remora-bot.ts`;
  - on the web: `features/remoras/describe-job.tsx`, `features/changes/` and one route.
- **No DB schema change.** Cards live in `remora_events`; contracts are new types in
  `packages/schema/src/steer.ts`.

## Consequences
- **Easier:**
  - a new owner starts from one sentence;
  - an owner changes a setting from Telegram without opening the dashboard, and still signs every
    limit.
- **Harder or not done:**
  - one remora can't pause on a schedule; nights map to the owner-wide quiet hours;
  - a draft can't pick tools or a non-monthly window;
  - contacts wait for B1;
  - each command and each draft costs one small-model call (rate limited per owner: 20 commands and
    6 drafts a minute).
- **Live checks for the lead after the merge:**
  - "Every weekday at 8, tell me if any of my wallets moved more than 50 USDC" hatches a working
    remora on testnet;
  - three commands from Telegram, one of them signed.
- **Docs:** `docs/remora-features.md` (B2, N9) and the U18 exit note, in Part D.

## Links
- [Goal U18](../goals/uy-18-learning-loop.md) (C1, C2, Hard rules) and
  [ADR-0119](0119-u18-learning-loop-everyday-money.md).
- [ADR-0111](0111-scale-pass.md) (sales as `action` events), [ADR-0042](0042-grok-bots-shape.md)
  (threads and rooms), [ADR-0109](0109-pay-only-at-listed-address.md) and
  [ADR-0110](0110-live-attack-bait-and-switch.md).
