# Landing review U17: triage (Nov 5, 2026)

The review is in [review.md](review.md). A new reviewer agent wrote it from screenshots only, at
1440×900 and on a Pixel 7. Its count: Blocker 0, Major 4, Minor 12, Nit 5. All four majors are
fixed, and so are the cheap minors.

## Fixed
| id | severity | fix |
|---|---|---|
| network-1 | Major | The Mini App is built (ADR-0115), so "Not yet" now lists only "SuiNS names for remoras" (ADR-0116). |
| network-2 | Major | "Ours, labeled" says the sellers, buyers and `@haiku` in "Remoras pay remoras" are our own test accounts, and that `@haiku` is the repo's example API. The house line says "eight house services". |
| network-3 | Major | The crew card shows the question in quotes, a lead row ("Crew lead → 3 members, all at once · pays 0"), each member as "↳ member Onchain → Sui risk check", and a total ("3 receipts · 0.025 USDC, each from its member's own limit"). "One signature" now reads "One wallet approval created a crew of four Researchers". |
| network-4 | Major | The band has a title: "Load test · Sui testnet · Nov 4, 2026 · 50 remoras under one test owner · payments only, no model". The stats carry their concurrency ("22 payments a minute: the ceiling from 5 to 20 at once"; "4.7s p95, one at a time (63s at 20 at once)"). The footnote is body-colour and names its source. |
| network-5 | Minor | x402, the Reef and the facilitator are glossed inline. The heading is "Anyone can sell to remoras". |
| network-6, 7 | Minor | "every spending limit read back onchain after the run"; "attempts over the cap or to an address off the allowlist, stopped onchain". |
| network-8 | Minor | The band title says "50 remoras under one test owner". |
| network-9 | Minor | Network's links read "receipt 7vkX…SGGb ↗", like Jobs. |
| network-10 | Minor | The subhead is "Each payment below…", the card says "Add Remora's MCP server to…", and the door names are plain text, not pill shapes. |
| network-13 | Minor | `section[id] { scroll-margin-top: 96px }`, so a nav click lands below the sticky bar. |
| network-14 | Minor | "@uy-researcher → Sui risk check, its source, at cost"; "Another owner's Researcher"; "(@names are Remora handles.)" |
| network-15 | Minor | "A Researcher → @haiku (writes a haiku), listed by another owner". |
| network-16 | Minor | The band names `apps/server/scripts/load-run.ts` and the JSON with every number. |
| network-17, 18, 19, 21 | Nit | A line break after "remoras."; one amount colour (teal); "63s"; on a phone, the last stat spans the row. |

## Not fixed (and why)
- **network-11 (tap targets):** receipt links are already at least 40 px tall on touch screens
  (`pointer: coarse`). The door names are no longer shaped like buttons.
- **network-12 (phone menu):** this is U14's header, unchanged in U17.
- **network-20 (ragged rows on a phone):** the hash wraps when a row is long. That's cosmetic.
