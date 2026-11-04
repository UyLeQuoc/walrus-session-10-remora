# Landing review U18: triage (Nov 5, 2026)

The review is in [review.md](review.md). A new reviewer agent wrote it from screenshots only, at
1440×900 and on a Pixel 7. Its count was Blocker 0, Major 3, Minor 10, Nit 9. All three majors are
fixed, as are most minors.

A first reviewer agent stalled after cropping the screenshots and was stopped; the second one read
the same shots.

## Fixed
| id | severity | fix |
|---|---|---|
| u18-1 | Major | **The numbers now add up for one Researcher.** The review card starts with the step that explains its 0.20: "✍ you signed · from chat: new monthly limit 0.20 USDC" (tx `GuQG…yHhX`, the C2 run, before the review). Card 1 names the limit as "new monthly limit 0.09 USDC", in a neutral colour. |
| u18-2 | Major | **The loop is shown with what the run measured.** "Its weekly review reads last week's" says it reads the last review first, and recalls both reviews and its notes before each answer. The lending card says the owner's 👍 became notes and quotes one: "sui-risk · 5 calls · 1 useful · 0 noise · $0.050 per useful answer". The Reef card says what "new" means: "too few owners and calls yet to score". No behaviour was claimed that the run didn't show. |
| u18-3 | Major | **One way to show who approved.** A "✍ you signed" chip marks wallet signatures: the limit raise, the lending, taking it back, adding Linh. A "✓ you said yes" chip marks a tap within the limit: dinner, the new price. The subheads explain both. The money subhead: "It pays only people you added with your wallet signature, under a spending limit Sui enforces, and anything unusual waits for your yes." The learns heading is "You sign every change to its money." |
| u18-4 | Minor | No weekdays. The subhead says "in one run on Sui testnet on Nov 5, 2026 (the weekly review ran on demand)". The Keeper's rows are "charge 1" and "charge 2". |
| u18-5 | Minor | One row: "cites 2 memories: answers that each paid 0.01 USDC for data", with both memory links. |
| u18-6 | Minor | The memory ids link to Walruscan (`walruscan.com/testnet/blob/<id>`) with ↗. The subhead says "its transaction or the memory it rests on". |
| u18-7 | Minor | The lending card is in plain words: "The notes are encrypted and stored on Walrus. A Sui policy (Seal) lets only that remora read them, and only until you revoke it." It lends for 3 days. The Reef card defines the Reef ("Remora's public list of paid services"). |
| u18-8 | Minor | "It reads every price quote (the HTTP 402 “pay first” reply) before paying." |
| u18-9 | Minor | "A remora that sells its answers has a public page"; "Every paid door also takes MPP, the other open pay-per-request standard". The MPP row is a sibling ("An MPP client → the same door, paid with MPP"), not a ↳ sub-step. |
| u18-10 | Minor | The split is two rows: "Settle up: a pay link, Linh owes you half of 0.40 · 0.20 USDC", then "Linh paid you from the pay link", with the receipt. |
| u18-13 | Minor | On touch screens, receipt and memory links are at least 44 px tall (they were 40). |
| u18-16 | Nit | The Reef chips use the display names "Sui risk check" and "Repo health". |
| u18-17 | Nit | New limits are a neutral colour. A refusal reads "blocked", in amber. |
| u18-19 | Nit | The money subhead is replaced (see u18-3). |

## Not fixed (and why)
- **u18-11 (phone menu)** and **u18-21 (header opacity):** U14's header, unchanged in U18. Also
  left as is in U17 (network-12).
- **u18-12 (the nav covers the section top):** each section already has
  `scroll-margin-top: 96px`, so a nav click lands below the bar. The reviewer saw the fixed bar
  over element screenshots.
- **u18-14 (equal-height cards):** the same grid as the Network section. The fuller chains above
  fill most of the gap.
- **u18-15 (`@haiku-u18`, `@u18-researcher`):** these are the run's real handles. Renaming them
  would misquote the receipts.
- **u18-18 (two lunches):** "I paid 0.40 for lunch for Linh and me" is the sentence the run used.
- **u18-20 (two places say anyone can buy):** Network covers agents over x402; this card covers
  a person on the public page.
- **u18-22 (wrapping on a phone, Network):** cosmetic, in U17's section.
