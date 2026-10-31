# Every flow on testnet, then a UX pass (Oct 31, 2026)

**The request.** Uy asked for three things: the README rewritten, the UI/UX improved, and every flow
verified. The decisions are [ADR-0088](../adr/0088-ux-pass-after-full-e2e.md) and
[ADR-0089](../adr/0089-ux-pass-retired-remora-and-status-label.md). Huấn's review notes are in the
[handoff](../handoffs/2026-10-31-uy-to-huan-ux-pass.md).

## The flows: `AUDIT=1 bun run e2e` (local stack on testnet, burner wallet)
| Run | Result |
|---|---|
| Full suite, 28.5 min | **46 passed, 2 failed, 2 skipped by design** (`RESUME`, `HTTP_CLAUDE`) |
| U8 failed | The gas station's Tatum call timed out (`read ETIMEDOUT`, with a Tatum 429 on the watcher), so the planned `sui-risk` purchase was refused (`x402.gas_station_refused`). This was infrastructure. Scout's answer didn't say a paid check had been tried; that is fixed in ADR-0088 |
| U12 failed | The test's fact differed from an earlier run's only by its stamp, so it was skipped as a duplicate. The new `memory.duplicate_skipped` log named the blob. The test now recalls the matched blob (ADR-0088) |
| Rerun U8 + U12, 6.4 min | **2 passed**: U8 in 3.6 min, U12 in 2.6 min |
| Audit pass, after each UI change, 8.8 min | **2 passed**: signed in and signed out, light and dark, now including `/playground`, `/hatchery`, `/status` and `/reef` |

So every flow in the suite passes on testnet:
- **smoke:** every page, on desktop and on a Pixel 7;
- **testnet:** sign in, detect, withdraw, move, pause all, resume;
- **w2:** first remora, a paid answer with an anchored Wake, an approval, a rule learned and applied,
  retire;
- **u6, u7, u8, u12 and u13**;
- **audit.**

The two skipped tests need `RESUME` or `HTTP_CLAUDE`.

## What the run showed, and what changed
| Seen | Change | Where |
|---|---|---|
| A refused planned purchase looked like a model that didn't know | The answer ends with "I tried to buy reef:sui-risk for this, but the payment didn't go through (code)… Ask again in a minute." A Sonar block on a planned buy gets its own line | `runtime/scout.ts` `unpaidNote`, test in `runtime.test.ts` |
| MCP `remora_remember` said "already in memory" without saying where | The text and `structuredContent.matched` name the blob | `mcp/tools.ts`, `runtime/memory.ts`, `mcp.test.ts` |
| The sidebar and the remora page showed the system prompt; the sidebar badge was cut to "S…" | `describeRemora`: the template's summary, or the persona without "You are X." The badge is gone | `features/remoras/describe.ts` (+test), `sidebar-team.tsx`, `remora-page.tsx` |
| "runs out around 2027-10-09" | "runs out around Oct 9, 2027", read in UTC | `budget-meter.tsx` `calendarDay` |
| Signed-out Home had no clear first step | **Try Scout, no wallet** and **Check a receipt** under the hero | `home-page.tsx`, test in `remora-pages.test.tsx` |
| A retired remora offered Ask, and its budget said "Reading the Disc…" forever | A "Retired" alert, no Ask or Teach card, and a budget section saying the Disc was revoked | `remora-page.tsx`, test in `remora-pages.test.tsx` |
| `/status` showed `tatum.usage` | The item is now `tatum usage` | `ops/health.ts` |

**Also seen on real data:** the inspector's ADR-0086 badge, "1 later write matched this", on the `me`
memory that U12's earlier runs had written.

## README
Rewritten for judges (`312c345`). It now has:
- a "For judges" table: entry and prizes, video, playground, blog, 360 mainnet memories, Tatum;
- "How it learns";
- "Agent payments: x402, settled on Sui";
- "What's real, what isn't".

The proof table, the generated Tatum call list and the prior-work timing are kept. The screenshots now
come from this audit pass.

## Checks
- typecheck 20/20, lint clean, test 15/15 (web 359, server including the new Scout and MCP cases);
- `bun scripts/check-links.ts` clean;
- `bun scripts/tatum-calls.ts --check` current (12 calls).

## Not verified
- **Anything on a deployed URL.** These runs use the local stack against Sui testnet and the real
  relayer and Tatum.
- **The `HTTP_CLAUDE` path** (real Claude Code over Streamable HTTP). It's opt-in and wasn't run.
