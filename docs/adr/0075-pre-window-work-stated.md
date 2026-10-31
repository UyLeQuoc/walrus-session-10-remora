# ADR-0075: State what was built before the build window, as it happened

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (written by Uy's agent)

## Context
- **The rules.** An existing project is allowed only for "new progress made during the build window"
  (Oct 20 – Nov 10), and a submission must be "completed or materially advanced" in it
  ([event-rules.md §3, §5](../event-rules.md#3-eligibility)).
- **The old claim.** [ADR-0018](0018-bootstrap-before-window.md) ran the bootstrap on Oct 18 and said:
  - no Remora feature would be built before Oct 20;
  - every feature commit, from U1 on, would be dated inside the window.

  The README repeated the first point: "No Remora feature was built before the window."
- **What happened.**
  - Goals U1–U5 and Huấn's first UI pass (PR #6) ran on Oct 19, all before Oct 20 00:00 UTC.
  - Together they are 33 commits tagged with feature IDs, covering the first two waves:
    - W1: the Disc Move module v1 on testnet, `disc-sdk`, the facilitator and gas station, the
      indexer and Wakes;
    - W2: the runtime, Sonar, Scout, Sentinel, approvals, verify, the inspector, Telegram commands and
      the web pages.
  - The last commit before the window is `3f9a2a6` (Oct 19, 14:37 UTC).
- **How a judge would see it.** The README's proof table links two notes dated 2026-10-19 (the Disc
  spike and the W2 exit). A judge who opens them sees the contradiction.
- **When it was found.** On Oct 31, while reviewing the entry the way a judge would.

## Decision
- **Say what happened wherever the claim was made.** The README's "Built on prior work" states three
  phases:
  1. the bootstrap on Oct 18;
  2. W1 and W2 on Oct 19, before the window;
  3. everything since.

  It names the cutoff commit `3f9a2a6` and gives the git commands to check it.
- **The README's proof table says when each proof was made** (a "Built" column), so window work and
  earlier work can be told apart.
- **No history rewrite.** No rebase and no changed dates: that would need a force-push and would hide
  the very thing this ADR discloses.
- **The window counts from Oct 20, 00:00 UTC** (07:00 in Vietnam), as ADR-0018 did. The first commit
  after the cutoff, `3c60cc2` (a UI polish), landed at 02:41 UTC.
- **The pitch leads with window work:** the learning loop (Proof of Learning, facts and admission),
  memory controls and export, the Hatchery, MCP, the playground and the web. The Disc, Scout, Sentinel
  and Sonar are presented as the foundation built on Oct 19.
- **ADR-0018 is superseded only in part.** Its decision stands, since the bootstrap ran on Oct 18. Its
  claim that no feature came before the window is superseded here.

## Consequences
- Judges get one timeline that git confirms, instead of a claim that git contradicts.
- **The story shifts.** The money rails are the core of Remora's story and came before the window. So
  the entry rests more on what the window added: the learning loop, memory you control, the Hatchery,
  MCP and the product around them. The demo, the blog and the README's first screen should be written
  that way.
- **Window rulings are easy to apply.** If the organizers count the window differently, or judge only
  window work, the cutoff commit gives them the diff.
- **Docs updated in this commit:**
  - `README.md`: the proof table's "Built" column, a facts row, and "Built on prior work";
  - `docs/reuse-from-hippo.md` §1;
  - ADR-0018's status;
  - the ADR index;
  - `docs/README.md`.

## Links
- [ADR-0018](0018-bootstrap-before-window.md) · [ADR-0006](0006-reuse-hippo-and-stack.md)
- [README.md](../../README.md#built-on-prior-work) · [reuse-from-hippo.md](../reuse-from-hippo.md) ·
  [event-rules.md](../event-rules.md)
