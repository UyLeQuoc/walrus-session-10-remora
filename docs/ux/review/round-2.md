# Round 2 (Nov 4, 2026)

**What was captured:** the app after round 2's fixes, up to dcced9a, shot with `UX=1 UX_ROUND=2`.
For the first time the shots include a verified receipt and a public proof.

**Gates before the capture:** e2e `smoke` and `mobile` passed, 38 of 38.

**Who reviewed:** four new reviewers. Each got the screenshots, [the rubric](README.md) and round
1's findings.

## The reviews
| Reviewer | Blocker | Major | Minor | Nit |
|---|---|---|---|---|
| [Desktop, start and money](round-2/desktop-start-and-money.md) | 2 | 5 | 34 | 6 |
| [Desktop, remoras and chat](round-2/desktop-remoras-and-chat.md) | 4 | 3 | 16 | 9 |
| [Desktop, memory, info, landing](round-2/desktop-memory-info-landing.md) | 0 | 1 | 48 | 9 |
| [Phone](round-2/phone.md) | 0 | 3 | 36 | 1 |
| **Round 2** | **6** | **12** | 134 | 25 |
| Round 1, for comparison | 10 | 21 | 149 | 17 |
| Round 0, for comparison | 17 | 55 | 174 | 30 |

**What was left:**
1. **The receipt pages.** Their checks were named like code ("Paid.intent matches", "payTo balance
   change"). The amounts were in base units ("10000 of 10000"). The timing check showed raw ISO
   stamps. The payment itself sat below the fold.
2. **One state for a remora whose spending limit is gone onchain.** The card said "active" next to
   "it can't spend". The Budget card listed the old limit with edit boxes, and Keys listed the Disc
   as if it were live.
3. **A retired remora** still showed editable settings and an empty danger zone.
4. **The wizard's count.** "At most 20 payments" was the count at the cap, not a maximum.

## Words (desktop, interface words in the main pane)
| Page (filled) | Above the fold, r0 → r1 → r2 | Total, r0 → r2 |
|---|---|---|
| Home | 169 → 101 → 119 | 1,270 → 154 |
| Remoras | 198 → 143 → 166 | 1,243 → 275 |
| A Researcher, Overview | 110 → 100 → 94 | 195 → 126 |
| A Wallet watcher, Overview | 120 → 102 → 93 | 120 → 110 |
| Funds | 100 → 56 → 56 | 100 → 56 |
| Approvals | 77 → 70 → 70 | 77 → 70 |
| Memory | 128 → 101 → 101 | 182 → 151 |
| Memory, Chat tab | 71 → 63 → 49 | 213 → 184 |
| Connections | 122 → 80 → 140 | 518 → 400 |
| Settings | 139 → 139 → 114 | 280 → 142 |
| Guide | 271 → 204 → 204 | 964 → 907 |
| Try a Researcher | 90 → 56 → 56 | 90 → 56 |
| Verify | 75 → 88 → 92 | 75 → 92 |
| Templates | 183 → 248 → 80 | 383 → 86 |
| New remora | 128 → 128 → 112 | 128 → 112 |
| Share | 192 → 204 → 204 | 219 → 204 |
| **All 64 states in both rounds** | **5,863 → 4,418 (−25%)** | **12,358 → 8,174 (−34%)** |

**Why Home and Remoras rose since round 1:** every card spelled out "No spending limit onchain: it
can't spend". The cards now say it with a "can't spend" chip and three words ("No limit onchain").

**Connections rose too.** The compact cards fit more tokens above the fold, each with its scopes as
chips.

## Triage
**Fixed before round 3's capture** (acfc377, 16727eb, d1f0b00, and the commit with these notes):

| Area | Findings |
|---|---|
| Receipts | G1 vreceipt-1, vreceipt-2, vreceipt-3, vreceipt-4, proof-1. **Changes:** the checks read in plain words, with the server's name as the tooltip. A balance check is in USDC. The timing check says "It decided as it paid" and shows three clock times, since the server allows 5 s of skew. A receipt card leads both pages: the remora's face, who paid what to whom, when, and whether it checks out |
| A limit gone onchain | G1 home-1, x-1; G2 remoras-1, rov-1, rset-1. **Changes:** the card and the header say "can't spend". The budget says "Was: …". Keys marks the Disc "revoked". Funds names the remora each limit belongs to |
| Retired remoras | G2 wov-1 (it shows the rules it learned), wset-1 (its settings are read-only, with no empty danger zone) |
| The rest | G2 new-1 (the wizard's count reads "at the cap"), tmpl-1 (a blocked template has no "Use it" at the top); G3 connect-1 (an expired link has one action, Open chat); phone thread-1 ("Pause all" is an icon on a phone again, so a chat's name fits) |

**Declined:**

| Finding | Why |
|---|---|
| G1 x-1 / G2 remoras-1, the roster's "live" | The roster reads one database row per remora. Reading 31 Discs every 30 s for the roster would go over the API's rate limit. The cards, the header and Funds read the Disc and say "can't spend" |
| Phone shell-2 (tap targets under 40 px) | They are 40 px. On a touch screen every small button gets a 40 px hit area (`index.css`, `pointer: coarse`), which a screenshot can't show |
| Phone landing-1 (the landing page's screenshots on a phone) | They're re-shot in Part D, from the frozen app |
| G2 rov-1, "Set a new limit (1 signature)" | The API can't issue a fresh Disc for an existing remora: Change budget revokes the old Disc and reissues, which needs the old one to exist. Listed as wanted. Its edit boxes are now hidden while the limit is gone |

**Left for round 3:** the minors and nits, the light theme (shot in round 3) and a last
consistency pass.
