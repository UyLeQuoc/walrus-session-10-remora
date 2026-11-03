# Round 4: the check before the freeze (Nov 4, 2026)

**What was captured:** the app after round 3's fixes, up to e9d9da3, in two runs:
- dark, desktop and phone: `UX=1 UX_ROUND=4`;
- light, desktop: `UX_THEME=light`.

**Who reviewed:** five new reviewers. Each got the screenshots, [the rubric](README.md) and round
3's findings, and was told to be strict about blockers and majors.

## The reviews
| Reviewer | Blocker | Major | Minor | Nit |
|---|---|---|---|---|
| [Desktop, start and money](round-4/desktop-start-and-money.md) | 1 | 0 | 38 | 11 |
| [Desktop, remoras and chat](round-4/desktop-remoras-and-chat.md) | 1 | 0 | 56 | 17 |
| [Desktop, memory, info, landing](round-4/desktop-memory-info-landing.md) | 1 | 0 | 51 | 14 |
| [Phone](round-4/phone.md) | 0 | 1 | 41 | 10 |
| [Light theme](round-4/light.md) | 0 | 0 | 12 | 8 |
| **Round 4** | **3** | **1** | 198 | 60 |

**Blockers and majors, round by round:**

| Round | Blockers | Majors |
|---|---|---|
| 0 | 17 | 55 |
| 1 | 10 | 21 |
| 2 | 6 | 12 |
| 3 | 4 | 10 |
| 4 | 3 | 1 |

**The four that were left:**
1. **The roster said "active" with a green dot** where a card read "can't spend". Two reviewers
   reported it.
2. **"Days left of 210" read wrong.** A blob stored 10 days ago showed 209 days left, because Walrus
   extends a blob by epochs. The term isn't counted from "Stored".
3. **On a phone, the landing page's screenshots were unreadable.** The crop added in round 3 only
   trimmed the edges; it didn't zoom.

## Words (desktop)
All 64 states in both rounds:

| | Round 0 | Round 4 | Change |
|---|---|---|---|
| Above the fold | 5,863 | 4,210 | −28% |
| In total | 12,358 | 7,419 | −40.0% |
| In total, without the room | 11,337 | 6,497 | −42.7% |

The room is listed separately because its messages count as words in every round. It's content,
but the counter never learned to skip it.

## Triage
**Fixed:**
- G1 x-1 and G2 x-1, in 7f7ebef. The roster's second line is now the remora's kind, and its dot
  marks only an exception: practice, paused, or being created.
- G3 memory-1, in 25547b8. A memory shows its real end date and the days to it.

**Moved to Part D:**
- Phone landing-1. The landing page's screenshots are re-shot from the frozen app, with crops made
  for a phone.

**The freeze:** every finding left is a minor or a nit. They're listed for after the submission,
in the exit note.
