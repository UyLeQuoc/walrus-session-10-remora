# Round 1 (Nov 4, 2026)

**What was captured:** the app after round 1's fixes (a21621b, 55a4088, df9361a), shot with
`UX=1 UX_ROUND=1`. That's 73 states a device. The shots now include a template page, but still no
receipt pages; the capture now looks the receipt up by `receiptId`.

**Who reviewed:** four new reviewers. Each got the screenshots, [the rubric](README.md), and
round 0's findings for its pages.

## The reviews
| Reviewer | Blocker | Major | Minor | Nit | Round 0 findings still open |
|---|---|---|---|---|---|
| [Desktop, start and money](round-1/desktop-start-and-money.md) | 3 | 3 | 36 | 5 | 11 |
| [Desktop, remoras and chat](round-1/desktop-remoras-and-chat.md) | 2 | 8 | 48 | 6 | 9 |
| [Desktop, memory, info, landing](round-1/desktop-memory-info-landing.md) | 1 | 5 | 38 | 5 | 3 |
| [Phone](round-1/phone.md) | 4 | 5 | 27 | 1 | 5 |

The four reviewers found 10 blockers between them, against 17 in round 0, and 21 majors against 55.

**What was still wrong:**
1. **Unknowns that looked empty, in three places.**
   - While loading, the roster showed "Import a team…". Before sign-in it had a stale empty list.
   - Home showed "No remoras yet" under its error card.
   - Chat said "you have no remora" while the list was loading.
2. **Money.**
   - "Ready to spend" on Home was blank, with no visible placeholder.
   - No remora card drew a meter. The burner's remoras had their spending limits revoked by the
     e2e setup, and the card called that "not readable".
3. **On a phone:**
   - the new bottom bar crowded the Approvals count onto the Funds icon;
   - feed rows cut their amounts;
   - a quoted package id ran off the screen;
   - the landing page left black screens.

## Words (desktop, interface words in the main pane)
| Page (filled) | Above the fold, r0 → r1 | Total, r0 → r1 |
|---|---|---|
| Home | 169 → 101 | 1,270 → 129 |
| Remoras | 198 → 143 | 1,243 → 228 |
| A Researcher, Overview | 110 → 100 | 195 → 124 |
| A Wallet watcher, Overview | 120 → 102 | 120 → 102 |
| Funds | 100 → 56 | 100 → 56 |
| Approvals | 77 → 70 | 77 → 70 |
| Memory | 128 → 101 | 182 → 151 |
| Memory, Chat tab | 71 → 63 | 213 → 196 |
| Connections | 122 → 80 | 518 → 491 |
| Settings | 139 → 139 | 280 → 205 |
| Guide | 271 → 204 | 964 → 907 |
| Try a Researcher | 90 → 56 | 90 → 56 |
| Verify | 75 → 88 | 75 → 88 |
| Templates | 183 → 248 | 383 → 282 |
| New remora | 128 → 128 | 128 → 128 |
| Share | 192 → 204 | 219 → 204 |
| **All 64 states in both rounds** | **5,863 → 4,686 (−20%)** | **12,358 → 8,637 (−30%)** |

**Why some pages went up:**
- **Templates** rose because hiding the blocked templates puts more real ones, with their
  descriptions, above the fold.
- **Verify** gained the receipt list and the four checks' names.
- **Share** gained the plain names of what stays with you.

**Still to cut:** Settings, New remora, Share and Templates are the pages most over 60 words above
the fold.

## Triage
**Fixed after this review, before round 2's capture** (commits 6c9701f, d80ff2d, 140d1d8,
b2f69e0, 6ad489e):

| Area | Findings |
|---|---|
| Unknowns | G1 shell-1, home-1, home-14; G2 shell-1, loadchat-1; G3 shell-1; phone home-1, home-2, chat-1, x-1, x-3. **How:** the roster shows skeleton rows while it loads after sign-in; Home keeps no empty state under an error; Chat waits for the list; a number still loading is a visible bar, and a balance that can't be read is a dash |
| Money and meters | G1 home-2, funds-1; G2 remoras-1, rov-1. **How:** the meter's track shows at zero. The spending limit is now told apart in three states: one the server says is gone onchain ("No spending limit onchain: it can't spend"), one that can't be read, and one being read. The Disc rows put the spent amount first, with chips for the cap, the payees and "ends in N days" |
| The feed and threads | G2 ract-1 (a payment links its transaction), thr-1 (a failed purchase is grey in threads too); phone feed-1 (rows wrap to two lines on a phone and never cut an amount), thread-1 (a quoted id wraps) |
| Pages | G1 verify-1 (Try a Researcher when you have no receipt); G2 rlearn-1 (the empty proof links to where you rate), wov-1 (a watcher's pings, ignored and rules), tmpl-1 (Use it at the top; consent before provenance); G3 conn-1 (New connection at the top), memchat-1 (who holds it is one Flow), status-1 (what a problem means, and when it was checked), x-1 (tokens of retired remoras are marked); phone home-3 (a new account's Home starts with the checklist), conn-1 (compact token cards), landing-1 (no reveal on a phone) |
| Phone shell | phone shell-1. **How:** the tabs are an icon over a label, the count sits on the icon, and the bar can hold five or six |
| Round 0's list | the roster's previews ("Researcher · live", the amount on a wait); upcoming times ("Today 3:00 PM"); the feed grouped by day; the wizard's "at most N payments a month"; plain room routes ("you named it", "best fit"); an approval that titles itself once decided; the panic button's label and 40 px touch targets on a phone |

**Declined:**

| Finding | Why |
|---|---|
| G1 home-8 (fold a payment into its answer) | The answer is the agent's text, and the payment is its own event, with its own receipt and Why?. The two sit next to each other in the timeline, under one day |
| G2 thw-1 ("…watching 1 address(es) on testnet:") | It's the stored text of an event that already happened. The watcher's overview now lists its wallets |
| G2 thr-1 (my question as a "Re:" line in a thread) | That question came from the remora's page or a schedule, not from this chat, so it's shown as context |
| G3 screens-1 (the landing page's screenshots are older than the app) | They're re-shot from the frozen app in Part D |
| G1 verify-1, signed out (a sample receipt) | No public receipt list exists to sample from; listed as data wanted. The page now offers Try a Researcher, which makes a receipt in a minute |

**Moved to round 3 (polish):**
- the minors and nits, especially the word cuts on Settings, New remora, Share and Templates;
- one kind badge;
- the date details left over;
- the light theme.
