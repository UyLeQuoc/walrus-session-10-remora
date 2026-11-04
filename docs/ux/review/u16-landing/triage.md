# Landing review U16: triage (Nov 4, 2026)

The review is in [review.md](review.md). A new reviewer agent wrote it from screenshots only, at 1440×900 and on a
Pixel 7. Its count: Blocker 1, Major 2, Minor 20, Nit 6. The goal asked us to fix the blocker and the
majors. The minors that cost a line or two were fixed too.

## Fixed
| id | severity | fix |
|---|---|---|
| landing-1 | Blocker | "Ours, labeled" now says all eight paid services are our demo merchants, that seven read live sources (Sui, Walrus, GitHub, CoinGecko, Open-Meteo, the page you name), and that the odds are a labeled sample. The Services screenshot comes from the U16 capture (`capture/reef`, Nov 4) and lists all eight. The phone image is a crop of the same frame. |
| landing-2 | Major | The jobs section has a limit meter: "0.07 of 0.50 USDC". It's real: on Nov 4 the `EXAMPLES=1` Researcher made seven payments under its 0.50 USDC monthly limit, and Sui enforces that limit. |
| landing-3 | Major | The proof card says 0.005–0.02 USDC per paid answer, the range the Reef's prices span. |
| landing-4 | Minor | The free card is a single full-width row now, so it no longer leaves two-thirds of the row empty. |
| landing-6 | Minor | The strip no longer repeats a card's receipt. It shows the other eight. |
| landing-7 | Minor | Strip pills carry ↗, like the cards' receipts. |
| landing-11 | Minor | On touch screens a receipt link has a hit area at least 40 px tall. |
| landing-12, 24 | Minor, Nit | The jobs subtitle reads "Each job ran on Sui testnet on Nov 4, 2026, and links its receipt." That ends the orphan and the repeat. The strip caption reads "More real testnet payments from the demo runs." |
| landing-14 | Minor | Both buttons and the honest box now read "1 USDC limit", matching the demo checklist and the screens. The problem card's meter keeps "0.58 of 1.00 USDC", the form the app itself shows. |
| landing-17 | Minor | Short forms with a link: blob `rbQ8…uMXw`, tx `7NYf…LnpSV ↗`. |
| landing-18 | Minor | The Status caption says what the screen shows: when Tatum is slow, it falls back to a public node. |
| landing-20 | Minor | The secondary grey went from `#6e6e80` to `#8b8b9c`, about 5:1 on the cards. |
| landing-27, 28 | Nit | "Sui enforces the limit"; JSON&#8209;RPC no longer breaks at its hyphen. |

## Not fixed (and why)
- **landing-5, 9, 10:** card spacing, type weight and a long stack on a phone. These are polish, and the
  cards read fine.
- **landing-8:** renaming "Brief" would change the Reef, the app, the video and the tests for one word.
- **landing-13, 29:** the hero headline and the poster. Both were chosen in U14 (ADR-0102) and the new
  video's poster is its first frame.
- **landing-15, 16:** jargon glosses and plain-word sources. Judges of a Sui/Walrus hackathon know
  x402 and MCP, and the sources link to code.
- **landing-19, 21, 22, 23, 25, 26:** the screens' scale, the phone URL pill, the timed reveal, the phone
  menu and mascot overlap. These are U14's layout, unchanged in U16.

All the unfixed items stay open for a later pass. None is a blocker or a major.
