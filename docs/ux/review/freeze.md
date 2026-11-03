# The freeze check (Nov 4, 2026)

**What was captured:** the app after round 4's fixes, up to 0c88a27, shot with `UX=1 UX_ROUND=5`,
dark, on a desktop and a phone.

**Who reviewed:** one new reviewer, who looked only for blockers and majors on every page. Another
new reviewer judged the demo video's frames before the render.

| Review | Blocker | Major | Minor | Nit |
|---|---|---|---|---|
| [All pages, desktop and phone](freeze/all-pages.md) | 2 | 1 | not listed | not listed |
| [The demo video's frames](freeze/video.md) | 4 | 14 | 18 | 3 |

**Round 4's findings:**
- All three blockers were confirmed fixed: the roster no longer says "active", and a memory shows
  its real end date.
- The landing page's phone screenshots were re-shot after the check.

## Words (desktop, the final capture)
| | Round 0 | Freeze | Change |
|---|---|---|---|
| Interface words, all 64 states | 12,358 | 7,354 | −40.5% |
| The same, without the room | 11,337 | 6,374 | −43.8% |
| Above the fold, all 64 states | 5,863 | 4,062 | −30.7% |
| Phone, all states | 12,302 | 7,296 | −40.7% |

## Triage
**The app, fixed in d59b78a and eebcb21:**
- **Event text reads in the app's units and names.** It said "Didn't pay 20000 to reef:odds"; it now
  says "Didn't pay 0.02 USDC to Odds" (`plainEvent`, tested).
- **Connections' picker** no longer shows a remora's status. A token's pill says "token live".
- **Share** keeps a way back when it can't share.
- **The playground's "Why? Check its receipt"** opens the payment's receipt (its transaction), not the
  answer's, which said "no money moved".
- **A spending limit's row** meters this month's window and shows its cap's own decimals (0.015).
- **A receipt's reason** reads "paid 0.01 USDC", not "paid 10000".

**The video, fixed in eebcb21 and 3035cba, then re-captured and rendered:**
- **Steppers.** The second stepper over the playground is gone.
- **Captions.** The 1 USDC limit has one. The budget caption comes in once both fields are filled. The
  teach chapter ends on the ignored transfer, without claiming the new rule did it. "A repeat isn't
  stored twice" replaces "shown, not dropped". Why? "shows what it decided, and why".
- **The close** gives the full address: getremora.vercel.app/playground.
- **Length.** Every caption is ten words or fewer, and the video runs 161 s.

**Declined:**

| Finding | Why |
|---|---|
| Video V-16, V-21, V-32 (the account's leftovers, old approvals and an unintroduced watcher) | The capture runs on the E2E burner, which carries every earlier test run. A clean demo account is listed for Uy |
| Video V-12 (zoom into each fact) | The storyboard already zooms on spotlights. More zoom is a re-cut, listed for after the submission |
| Video V-19 (the cost card in $) | The model's cost is priced in dollars by the provider. Listed with the other minors |
| Video V-29 (no footage of the aborted payment) | The abort is on testnet (`7NYf3QGE…`) and in CI. Footage of it is listed |
