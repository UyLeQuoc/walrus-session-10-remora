# Round 0: the baseline (Nov 4, 2026)

The app as it stood at `pre-u14-ui` (f2a29d3), shot with `UX=1 UX_ROUND=0`: 64 states on a desktop
and 64 on a phone, filled with the E2E burner's account (120 remoras from earlier runs, 31 live,
19.78 USDC, 2 approvals waiting).

**Gaps in this round's capture:**
- The capture missed `hatchery-template`, `verify-receipt` and `public-receipt`, because of two wrong
  lookup keys that are fixed for round 1.
- Room messages are counted as interface words in every round. They're content, but the counter
  never learned to skip them. The exit compares totals both with and without the room, so this
  doesn't change the trend.

## The reviews
Four fresh reviewers saw only the screenshots and [the rubric](README.md):

| Reviewer | Scope | Blocker | Major | Minor | Nit |
|---|---|---|---|---|---|
| [Desktop, start and money](round-0/desktop-start-and-money.md) | Home, playground, onboarding, sign-in, Approvals, Funds, Verify, the shell | 7 | 14 | 35 | 5 |
| [Desktop, remoras and chat](round-0/desktop-remoras-and-chat.md) | Remoras, a remora's tabs, new, import, share, chat, threads, rooms, Templates | 2 | 17 | 59 | 10 |
| [Desktop, memory, info, landing](round-0/desktop-memory-info-landing.md) | Memory, Connections, Settings, Guide, Status, Services, Connect, Lab, the landing page | 4 | 10 | 50 | 14 |
| [Phone](round-0/phone.md) | Every page at 412 px, phone-specific only | 4 | 14 | 30 | 1 |

**What they agreed on:**
1. **An unknown looked like a fact.** While data loaded or the server failed:
   - Home showed zeros and the new-account page;
   - the roster looked empty;
   - Approvals said "You're all caught up";
   - Funds said "Nothing to move".
2. **The number that matters was a sentence or missing.** Budgets read "Budget not readable just
   now", the money path was an arrow sentence, and a payment's cap was never shown.
3. **The feed showed internals.** It had `<untrusted>` tags and raw Markdown. A red "Blocked" was
   used for a service that failed ("the service answered 200"), which reads as the limit stopping
   it.
4. **Too much on one page.** Home and Remoras were 5,000 px or more each. Explanations repeated on
   every page.
5. **On a phone,** the bottom bar reached only the roster and "Page". Long ids ran off the screen.

## Words (interface words in the main pane; user and agent content skipped)
| Page (filled, desktop) | Above the fold | Total | Phone, above the fold |
|---|---|---|---|
| Home | 169 | 1,270 | 63 |
| Remoras | 198 | 1,243 | 63 |
| A Researcher, Overview | 110 | 195 | 73 |
| A Wallet watcher, Overview | 120 | 120 | 96 |
| Funds | 100 | 100 | 101 |
| Approvals | 77 | 77 | 78 |
| Memory | 128 | 182 | 76 |
| Memory, Chat tab | 71 | 213 | 71 |
| Connections | 122 | 518 | 119 |
| Settings | 139 | 280 | 105 |
| Guide | 271 | 964 | 166 |
| Try a Researcher | 90 | 90 | 91 |
| Verify | 75 | 75 | 76 |
| Templates | 183 | 383 | 84 |
| New remora | 128 | 128 | 106 |
| Share | 192 | 219 | 193 |
| **All 64 desktop states** | **5,863** | **12,358** | 4,500 (phone) |

**Over the budget:** 15 of these 16 pages were above 60 words above the fold (the guide's budget is
120). Only Services, Status, Import, Onboarding and the chat were under it.

## Triage
Every finding is fixed, declined with a reason, or moved to the round whose focus it fits.

**Fixed in round 1** (commits a21621b, 55a4088, df9361a):

| Area | Findings |
|---|---|
| Unknowns and errors | G1 shell-1, home-1, home-18, home-19, approvals-5, approvals-6, funds-7, funds-8; G2 loadrem-1, loadrem-2, errrem-1, errchat-1; G3 shell-5, memerr-1; phone x-1, x-2, x-3. **Changes:** one `Problem` card for errors, skeletons in the final shape, and a setup card that waits for real data |
| Numbers as pictures | G1 home-2, funds-3, funds-4, approvals-1; G2 remoras-1, rov-1, rlearn-2, wlearn-1; G3 memory-1 (skipped duplicates now count as found), status-1. **Changes:** meters, a money Flow, the cap meter on an approval, n-of-m on learning rates, and Status grouped in plain names |
| The feed | G1 home-4, home-5, home-8, home-9; G2 remoras-3, remoras-4, remoras-11, ract-1, x-6 (payments). **Changes:** a `Timeline` with one icon per kind. A guard's "Blocked" is now told apart from a service that "didn't go through". Answers render as Markdown, without wrappers |
| Less on a page | G1 home-3, home-11, home-12, home-13, home-14, playground-1, playground-3, funds-6, verify-2; G2 remoras-2, remoras-10, emptyrem-2, share-1, share-2, share-3, share-4, import-1, hatch-1, hatch-3, emptychat-1, wov-1, wov-2; G3 settings-1, memchat-1, memchat-3, memchat-4, connect-1, connect-2, connect-3, conn-1, status-4, problem-1, problem-2, how-1, demo-1, landing-1; phone home-1, remoras-2, conn-1, memory-1 (exports) |
| Phone | phone shell-1 (Home, Chat, Approvals, Funds, More), feed-1 (long tokens wrap), remora-2 (the Brain picker names its model), share-1, guide-1, signin-1 and G1 sign-in-1 (Get Slush, Try without a wallet), landing-2 (sections reveal earlier) |
| Consistency | G1 x-1 (USDC, not $, for balances), x-5, x-6, x-8 (one error card, one empty state, skeletons); G2 x-1 (one budget meter with skeleton, value and "can't be read") |

**Declined:**

| Finding | Why |
|---|---|
| G3 memory-2 (lead each row with the memory's text) | The API returns no text for a row; text comes only from search. Listed as data wanted |
| G2 chat-3 (the ASCII ocean moves) | It's the empty chat's art, gone once you type, and still under reduced motion |
| G1 funds-2 (the Budgets list shows one Disc) | It lists the Discs onchain. The test account's remoras had theirs revoked by the e2e setup, so it's a state of the data. Their cards now say "Limit not readable now" |
| G1 home-15 (create a Wallet watcher before adding USDC) | A change to the setup flow, not to the interface |
| G1 onboarding-3 (a faucet on the checklist) | Funds' Add USDC now has the address and the faucet link |

**Moved to round 2** (data and flows):
- **The roster:** G1 shell-3, shell-4, shell-6. Its previews show the persona, not the last event.
- **Short forms and names:**
  - long package ids in text, and old names in events: G1 home-6, home-7, home-10; G2 remoras-5, remoras-8;
  - the remora's name in other places: G2 x-3, x-4, x-10; G3 x-1.
- **Days and dates:** G2 ract-3 (group by day) and x-7 (one date format).
- **Settings, threads and rooms:** G2 rset-1 to rset-5, wset-1, wset-2, thr-1, thr-2, thw-1, thw-2, room-1 to room-3, x-11.
- **The new-remora wizard:** G2 new-1 to new-4 and x-13 (one name for the per-payment cap).
- **Connections and Memory details:** G3 conn-2 to conn-5 and memchat-2, memchat-5, memchat-6.
- **Phone:**
  - the panic button and tap targets: phone shell-2, shell-6;
  - the landing page's screenshots on a phone: phone landing-1, re-shot in Part D.

**Moved to round 3** (polish):
- the nits;
- the guide: G3 guide-1 to guide-5;
- Services, Status and Lab: G3 reef-1 to reef-4, status-2, status-3, lab-1;
- the landing page's proof and video poster: G3 proof-1, proof-2, demo-2 (re-shot in Part D);
- G2 x-9 (one kind badge), x-12 (the model's name);
- the light theme, which is shot in round 3.
