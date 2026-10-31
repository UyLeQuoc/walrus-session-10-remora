# ADR-0088: A UX pass after the full e2e run

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (asked for "README, enhanced UI/UX, verify all flows"; built by Uy's agent)

## Context
Uy asked for a README rewrite, better UI/UX, and every flow verified. On Oct 31, the agent ran the
whole Playwright suite on testnet, with the audit pass (`AUDIT=1 bun run e2e`, 28.5 minutes).
- **46 passed and 2 failed.** Two more were skipped by design: they only run with `RESUME` or
  `HTTP_CLAUDE`.
- **U8, the playground, failed on infrastructure.**
  - The gas station's Tatum call timed out (`read ETIMEDOUT`, with a Tatum 429 around it), and the
    planned `sui-risk` purchase was refused.
  - Scout then answered "I can't tell you" and never said that a paid check had been tried. That part
    is a UX bug.
- **U12, MCP, failed on dedupe.**
  - The test's fact differed from an earlier run's only by its stamp, so `remora_remember` skipped it
    as already known.
  - The new `memory.duplicate_skipped` log from ADR-0086 showed which blob it matched.
  - The test then waited for its stamp, which was never written. Its second path also matched
    "Already in memory", which no longer matched the tool's text ("Already in Scout's memory").
- **The screenshots showed three UX problems:**
  - The sidebar and the remora page showed `config.persona`, the system prompt ("You are Scout. You
    answer the owner's questions…"), as the remora's description. In the sidebar, the template badge
    was cut to "S…".
  - The budget forecast read "runs out around 2027-10-09".
  - Signed out, Home, the first page a judge opens, offered "Try Scout, no wallet" only as a small
    sidebar row.

## Decision
- **Scout says when a planned purchase didn't go through.**
  - `unpaidNote` appends one italic line to the answer:
    - for an infrastructure failure, "I tried to buy reef:sui-risk for this, but the payment didn't go
      through (code), so this answer doesn't use it. Ask again in a minute.";
    - for a planned buy that Sonar blocked, "Sonar stopped a payment to …".
  - Purchases the model makes through its tool already return their outcome to the model, so they get
    no extra line.
  - The Wake hashes the answer with the note.
- **MCP `remora_remember` names the memory a duplicate matched.**
  - Text: "Already in Scout's memory (blob X); nothing new was written."
  - `structuredContent.matched`: the matched blob.
  - `RemoraMemory.remember` passes the port's matched blob through.
- **The U12 e2e accepts a duplicate.** When the fact comes back `alreadyKnown`, it recalls the matched
  blob. The resumed path reads `structuredContent.alreadyKnown` instead of matching text.
- **Readable remora descriptions.**
  - `describeRemora` shows the template's summary when the persona is unchanged.
  - An edited persona loses its opening "You are <name>." sentence.
  - It's used in the sidebar and in the remora page header.
  - The sidebar row drops the truncated template badge. Its accessible label still names the template.
- **Readable dates.** The budget forecast reads "Oct 9, 2027", taken in UTC because it's a calendar
  day.
- **Signed-out Home** gets two buttons under the hero: **Try Scout, no wallet** (`/playground`) and
  **Check a receipt** (`/verify`).
- **Lanes.**
  - The web and e2e changes are follow-ups Uy asked for, taken under ADR-0087 and ADR-0027.
  - The handoff tells Huấn what changed.
  - The server changes are Uy's lane.

## Consequences
- A failed payment is visible in the answer, in the Wake, and in the feed's `payment`/`blocked`
  events. It no longer looks like a model that doesn't know.
- Agents over MCP can recall or correct the exact memory that already holds a fact.
- The e2e no longer depends on the `me` namespace being empty of earlier runs' facts.
- Judges land on a page whose first button runs a real paid answer, with no wallet.
- The playground still depends on Tatum answering the gas station. A Tatum timeout now shows as a
  sentence the visitor can act on ("ask again in a minute").

## Links
- [ADR-0086](0086-owner-memory-first-and-visible-duplicates.md) ·
  [ADR-0087](0087-uy-merges-additive-contract-prs.md) · [ADR-0051](0051-playground.md) ·
  [handoff](../handoffs/2026-10-31-uy-to-huan-ux-pass.md)
- `apps/server/src/runtime/scout.ts`, `apps/server/src/mcp/tools.ts`,
  `apps/web/src/features/remoras/describe.ts`, `apps/web/src/features/home/home-page.tsx`,
  `e2e/tests/u12.spec.ts`
