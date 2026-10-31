# U9 without the deploy, and the launch docs (Oct 31, 2026)

**The request.** Uy, after the judge-style review: "còn gì làm giúp tôi làm hết đi" (whatever is left, do
it all). Everything that needs no deploy, no mainnet money and no outward post is done here. The rest is
the list at the bottom.

## What landed on `main`
| Commit | What | ADR |
|---|---|---|
| `389548a` | The pre-window work stated as it happened: cutoff `3f9a2a6`, a "Built" column in the README's proof table | [0075](../adr/0075-pre-window-work-stated.md) |
| `1e28223` | U9 Phase A: `/api/status`, the cost card (gas priced by Tatum's Data API), the Reef directory, public proof links, account export and retire-all; answers to Huấn | [0076](../adr/0076-u9-backend-for-huan-pages.md) |
| `a85bf86` | The reality check: a `Paid` with no Wake alerts the owner | [0077](../adr/0077-reality-check-unexplained-payments.md) |
| `fdda719` | D5: Sentinel's `check` rule hands an airdrop to Scout | [0078](../adr/0078-sentinel-hands-off-to-scout.md) |
| `cb26d7d` | I3: `bun run evals`, **28 attacks, 0 overspends**, in CI | [0079](../adr/0079-red-team-evals.md) |
| `c68c41a` | Tatum follow-ups: `tatum.usage` in health, no backfill on a watched-set re-subscribe | [0080](../adr/0080-tatum-usage-in-health-and-no-resubscribe-backfill.md) |
| `bd287b5` | The launch story: README "In one minute", the demo script, the blog's honesty sections, MemWal issue drafts and social drafts | [0081](../adr/0081-launch-story.md) |
| `53cbc96` | CI was red from `389548a` on: a new OSV advisory on `follow-redirects`, which comes in through `@slack/bolt` › `axios`, blocked the install. The override goes to `>=1.16.2` | [0082](../adr/0082-follow-redirects-1-16-2.md) |

The contract PR for Huấn's pages and F15's facts is
[#17](https://github.com/UyLeQuoc/walrus-session-10-remora/pull/17). Uy merged it on Oct 31 as `e7001fe`,
before Huấn's review ([ADR-0083](../adr/0083-contract-pr-17-merged-before-review.md)).

## Checks (each push)
- **CI.** Red on GitHub from `389548a` to `bd287b5`, at the install scanner, not at the code. ADR-0082
  fixes it; see the run for `53cbc96`.
- `git pull --rebase`, then typecheck 20/20 and lint clean.
- Test 15/15 tasks.
- The link check is clean.
- New tests:
  - `runtime.test.ts`:
    - "U9 backend";
    - "a Paid with no Wake";
    - "a check rule hands an airdrop to Scout".
  - `ops.test.ts`: public status and Tatum usage.
  - `rates.test.ts`.
  - `triggers.test.ts`: no backfill after a set change.
  - `safety.test.ts`: the check rule.
  - The three attack suites.
  - Schema fixtures: 64/64, on the PR branch.
- **History secret scan.** All 163 commits on every branch were scanned for 15 credential patterns: 0
  real hits. The 2 hits were test fixtures in `packages/memory`, a redaction test and a fake key.
- **Live calls.** Tatum's rate API answered 200 with both keys (SUI ≈ $0.896, from CoinGecko through
  Tatum).

## Not verified
- **Anything deployed.** `/status`, the cost card, proof links, export and retire-all, D5 and the
  reality check are tested in-process with a fake chain. None has run on the testnet URL; U9's exit does
  that.
- **Huấn's pages against the real endpoints.** That waits for the deploy (PR #17 is merged).
- **The `check` rule through the model path.** The phrase parser is tested; a model-parsed `check` rule
  isn't.

## The list for Uy
1. ~~**Merge PR #17** once Huấn approves.~~ Merged Oct 31 (`e7001fe`), before his review (ADR-0083).
2. **Before the deploy, push the schema by hand to the target database** (deploy.md step 2):
   - `memory_facts` (F15);
   - `receipts.share_token` and `shared_at` (ADR-0076).
3. **Run U9 Phase D** (`pbcopy < docs/goals/uy-09-testnet-launch.prompt.txt`). It needs:
   - rotated Tatum keys and bot token;
   - testnet SUI for the burner, the gas station and the playground funder;
   - a playground key;
   - Railway and Vercel logins.
4. **Start dogfooding the day it's deployed.** Watch your own testnet address with a Sentinel that has
   "check airdrops with Scout", and ask Scout daily. The blog's "how it learned over time" needs those
   days.
5. **Record the video** from the new script in [remora-plan.md](../remora-plan.md). Prepare the reality
   check script first (a Disc payment signed outside the runtime).
6. **Publish the blog** from [blog-draft.md](../launch/blog-draft.md), then send
   [the posts](../launch/social-drafts.md).
7. **File the MemWal issues** from [the drafts](../launch/memwal-issue-drafts.md), after checking which
   hippo already filed.
8. **Decide U10.** Mainnet money isn't a requirement, and Walrus Memory is already on mainnet.
   Recommendation: skip it unless 1–7 are done by Nov 8.
9. **Decide Receipts and Kitty.** The rules allow one submission per person. To aim for first place with
   Remora, let Huấn enter at most one of them, or neither.
10. **Nov 9: make the repo public** after a last read of the README, and submit the form.
