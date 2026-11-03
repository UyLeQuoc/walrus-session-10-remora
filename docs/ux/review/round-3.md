# Round 3 (Nov 4, 2026)

**What was captured:** the app after round 3's fixes, up to de41d44.
- Dark, desktop and phone: `UX=1 UX_ROUND=3`.
- Light, desktop, for the first time: `UX_THEME=light`.

**Who reviewed:** five new reviewers. Four of them got the screenshots, [the rubric](README.md) and
round 2's findings. The fifth judged the light theme only.

## The reviews
| Reviewer | Blocker | Major | Minor | Nit |
|---|---|---|---|---|
| [Desktop, start and money](round-3/desktop-start-and-money.md) | 2 | 2 | 38 | 10 |
| [Desktop, remoras and chat](round-3/desktop-remoras-and-chat.md) | 2 | 3 | 51 | 18 |
| [Desktop, memory, info, landing](round-3/desktop-memory-info-landing.md) | 0 | 1 | 49 | 14 |
| [Phone](round-3/phone.md) | 0 | 2 | 37 | 6 |
| [Light theme](round-3/light.md) | 0 | 2 | 9 | 7 |
| **Round 3** | **4** | **10** | 184 | 55 |

**The trend in blockers and majors:** round 0 had 17 and 55, round 1 had 10 and 21, round 2 had 6
and 12, and this round has 4 and 10. The stop rule needs none, and the freeze was three days away,
so [round 4](round-4.md) checks the fixes below.

**What was left:**
1. **"Ready to spend 19.78 USDC"** overstated what the remoras could spend: one limit of 0.10 USDC
   was live.
2. **The timing check** still read as "paid, then decided" to the second.
3. **A card said "active"** before its limit had been read. A thread's header said "active" where the
   remora's own page said "can't spend".
4. **The receipt card on Verify** named the remora by its id. **The public proof** gave a stranger no
   next step.
5. **A decided approval in a room** still asked "Pay …?".
6. **Light theme contrast:** white digits on the amber count badge, and an invisible off switch.
7. **The signed-out guide** offered three first steps.

## Words (desktop)
All 64 states in both rounds:
- **Above the fold:** 5,863 → 4,328, which is −26%.
- **In total:** 12,358 → 8,058, which is −35%.

The guide's cut and its folded reference sections landed after this capture, so they show in round 4.

## Triage
**Fixed before round 4's capture** (7342907, 7e375f5, 67868aa, 88a8e2c, e9d9da3):

| Area | Findings |
|---|---|
| Money | G1 funds-1. **Change:** the tile is "Your balance", and Funds says "Your USDC, and the limits on it" |
| Receipts | G1 vreceipt-1 (Verify names your remora; a stranger sees "A remora"), vreceipt-2 ("decided and paid within N s", with the date), proof-1 ("Check it yourself" and "What's Remora?") |
| One status | G2 remoras-1, thr-1. **Change:** one spend-aware chip (`useSpendStatus`, `SpendBadge`) on cards, on a remora's header and on a thread's header. It says "checking" while the limit is read and "can't spend" when the limit is gone, and never "active" first |
| Rooms and templates | G2 room-1 (a decided approval reads "You paid … from your wallet"), tmpl-1 (the safety findings are one plain line each, with the field and the full reason as the tooltip) |
| Phone | chat-1 (the chat's art stays off a phone, and away from an error or an empty state), landing-1 (each screenshot is cropped to the part that reads) |
| Light theme | light shell-1 (dark ink on the amber badges), settings-1 (the off switch has a visible track and a ringed knob), loading-1 (skeletons use the border tone), funds-1 (a tinted node's subtitle takes the node's ink) |
| Info pages | G3 outguide-1. **Change:** signed out, the guide offers one first step, Try a Researcher, with Sign in beside it |

**Declined:**

| Finding | Why |
|---|---|
| G2 rlearn-1 (a failed answer counts as answered from memory) | The rate is computed by the server's learning series, and the API was out of scope. Listed as wanted: count a purchase that failed as "couldn't answer". The page already shows "1 of 3 answers · too few to tell yet", muted |
| G1 x-1, the "e2e-burner" spending limit | That Disc belongs to the test wallet itself, not to a remora. Rows that belong to a remora now show its face and name |

**Left as minors and nits for after the freeze:** the light theme's disabled buttons, the selected
kind card and the two styles of segmented control; uneven input widths; the guide's contents list.
