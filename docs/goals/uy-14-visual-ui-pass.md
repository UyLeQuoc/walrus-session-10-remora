# Goal U14: a visual-first web (fewer words, data at a glance, three review rounds), then the video again

- **Owner:** Uy's agent. It claims the look of `apps/web` from Huấn ([ADR-0027](../adr/0027-flex-takeover.md),
  [claim note](../handoffs/2026-11-04-uy-to-huan-u14-claim.md)).
- **Decision:** [ADR-0103](../adr/0103-visual-first-ui-pass.md).
- **Runs in:** `/Users/uydev/orca/projects/walrus-session-10`, on the branch `u14-visual-ui`, merged
  through a PR.
- **Time box** (Vietnam time; the deadline is Nov 10, 17:00 UTC, and the target is Nov 9):

  | When | What |
  |---|---|
  | Nov 4 | Part A (measure, round 0) and Part B (the kit) |
  | Nov 5 | Round 1 |
  | Nov 6 | Rounds 2 and 3 |
  | **Nov 7, 12:00** | **The freeze, whatever is left** |
  | Nov 7 | The video: capture, then the render overnight |
  | Nov 8 | Uy uploads the video and publishes the blog |

**Goal:** a judge who has never heard of Sui, Disc or x402 understands each page in five seconds. Each
page says what it's for in one line, shows its numbers as pictures, and offers one main action. The
explanations are still one click away. A fresh reviewer checks every page and section three times, and
the agent fixes what it finds. When nothing big is left, the demo video is made again from the new app.

## Before you start
- **Read:**
  - ADR-0103, then ADR-0094, 0095, 0098 (faces with moods), 0101, 0069 and 0070 (the openbot frame),
    0088 and 0096;
  - `docs/ux/README.md`, `apps/web/src/app/{routes,app-layout}.tsx` and `apps/web/src/index.css`;
  - `e2e/tests/audit.spec.ts` and `e2e/tests/demo.spec.ts`;
  - `docs/launch/demo/README.md` and `apps/landing/README.md`.
- **Pull:** `git pull --rebase --autostash origin main`.
  - `docs/README.md` (the Hunch row) and `docs/ideas/track-1-hunch-prd.md` are Uy's uncommitted
    files. Leave them uncommitted and untouched.
- **Huấn's state:**
  - On Nov 4 he had no commits since Oct 30 and no open PRs. Check again.
  - If he has started something in `apps/web`, leave those files for last and add a line to the claim
    note.
- **Rollback point:** tag `pre-u14-ui` on `main`, push the tag, and branch `u14-visual-ui` from it.
- **The local stack:**
  - `bun run dev` (Docker Postgres), with the root `.env` that the e2e suite needs (the burner).
  - The burner's account already has remoras, receipts, memories and Discs: use it for the filled
    states.
  - Never kill processes on ports 8787 or 5173.

## Part A: measure (round 0)
1. **Capture every route in every state.** Extend `audit.spec.ts` behind `UX=1`. It stays opt-in and
   read-only: it signs in and reads, and it never pays.
   - **Add the routes the audit doesn't cover yet:**
     - `/connections`, `/chat/r/:id` (a thread with a paid answer), `/chat/room/:id`;
     - `/remoras/import`, `/remoras/:id/share`, `/hatchery/:id`;
     - `/verify/:ref` (a real receipt) and `/p/:token` (a public receipt);
     - the sign-in screen, and every tab of a remora's page;
     - `/approvals` with a pending item, if the burner has one. Otherwise note that it's missing.
     - `/lab` gets one look for broken layout only. It's an ops console.
   - **The landing page:** `/` and `/about`, served from `bun apps/landing/build.ts`'s output. Shoot
     each section.
   - **States:**
     - filled: the burner;
     - empty: a freshly generated test key, never funded;
     - for Home, Chat, Funds, Approvals, Memory and a remora's page: loading (a slowed API) and an error
       (the API stopped).
   - **Sizes:**
     - 1440×900, dark, above the fold and the full page;
     - Pixel 7, dark;
     - light at 1440 in round 3 only.
   - **Where the shots go:** `docs/ux/review/r<N>/{desktop,phone}/<page>[-<state>].png`. Add
     `docs/ux/review/r*/` to `.gitignore`; only the notes are committed.
2. **Count the words.** The same run writes `docs/ux/review/r<N>/words.json`. For each page it records
   the interface words inside the main pane (`[data-slot=sidebar-inset]`, not the rail or the roster),
   above the fold and in total.
   - It skips anything inside `[data-ux-skip]`. Mark the containers of user and agent content with it:
     chat messages, memory text, code and remora names.
   - It skips tokens that are numbers, amounts, percentages, times, addresses or digests.
3. **Round 0 is the baseline.**
   - Run the reviewer (see "The review") on round 0's shots.
   - Commit `docs/ux/review/round-0.md`: the findings and the word table.
   - Copy the rubric to `docs/ux/review/README.md`, so later passes can reuse it.

## Part B: the visual kit
- **Build the kit before round 1's fixes.** It lives in `apps/web/src/components/visual/`: Remora's own
  code, MIT, never inside `openbot/`.
- **The pieces** (change the list if round 0 says so):

  | Piece | What it shows | Where it's likely used |
  |---|---|---|
  | `Stat` | A big number, its unit and a one- or two-word label; an optional change or sparkline | Home, Funds, a remora's Overview, Status |
  | `Meter` | Spent against a limit for a period; changes colour at 80% and 100% | Funds, remora cards, the new-remora budget, the playground |
  | `Ring` | The same as `Meter`, compact, for rows | the roster, remora cards |
  | `Flow` | Nodes and edges in SVG; a dot runs along an edge when something moves | where the money goes, a payment's steps, the guide, empty Home |
  | `Steps` | A horizontal stepper with icons and the current step | onboarding, a new remora, the playground, import and share |
  | `Timeline` | One icon per kind of event (paid, blocked, learned, pinged, approved), an amount chip, a relative time | a remora's Activity, Home, Approvals history |
  | `Receipt` | A ticket: the amount, the payee by name, the time, a "checks out onchain" mark with the digest | chat, Approvals, Verify, `/p/:token` |
  | `Checks` | Layers that light up pass or fail, one by one | the safety layers (safety check, gas station, spending limit), Verify |
  | `ExpiryBar` | The days a memory has left, out of about 210 | Memory |
  | `Spark` | A small trend line in inline SVG | Learning, cost over time |
  | `StatusDot` | ok, degraded or down, plus a label for screen readers | Status, Connections, the network badge |
  | `Empty` | A remora face (its mood fits, ADR-0098), one line, one button | every empty state, Not found |
  | `Hint` | A `?` that opens one sentence and a guide link | where the explanations go |
  | `Amount`, `Address`, `Digest` | One way to show money, and short forms with copy and an explorer link | everywhere |

- **Rules:**
  - Use the existing tokens and the chart tokens. Every piece works in both themes.
  - Use `motion`, `lucide-react`, `recharts` and inline SVG, which the web already has. A new
    dependency needs an ADR first.
  - Animation shows a change: money moving, a check passing, a meter filling.
    - Transitions in the interface take 400 ms or less.
    - A loop runs only in a diagram, and pauses off screen.
    - Reduced motion shows the end state.
  - Every visual-only fact has a text alternative: an `aria-label`, `sr-only` text or a `title`.
  - Charts and diagrams with real data load lazily if they're heavy.
- **Show the kit on one page:** `/lab/visual` shows every piece in both themes. `features/lab/` is
  Uy's lane.
- **Tests and docs:**
  - a component test per piece, covering its label, its states and reduced motion;
  - a "Visual kit" section in `docs/ux/README.md`.

## Part C: the loop (rounds 1, 2 and 3)
**Each round:**
1. **Capture:** Part A's run, into `r<N>/`.
2. **Review:** a fresh reviewer, as described in "The review", writes `docs/ux/review/round-<N>.md`.
3. **Triage:**
   - Mark each finding *fix* or *decline*.
   - A decline needs a reason the next reviewer can check, for example "an e2e label", "data the API
     doesn't return" or "ADR-0094 vocabulary".
4. **Fix:**
   - Go by severity, one page group at a time.
   - Make small commits, e.g. `[U14·ui] Funds: limits as meters, one line on top`.
   - The tests and selectors change in the same commit as the code.
5. **Gates:**
   - typecheck, lint, test and build;
   - e2e `smoke` and `mobile`.
6. **Push the branch.**

**What each round looks at.** Every round checks every page; the focus moves.

| Round | Focus |
|---|---|
| 1 | **Structure and words.** What each page is for, and its one action. Cut and move words; turn data sentences into the kit's pieces; empty states |
| 2 | **Data and flows.** Numbers, meters, timelines and receipts. The step flows: a new remora, the playground, an approval, verify. Phone layouts |
| 3 | **Polish and consistency.** Spacing, alignment, motion, the light theme, accessibility, the same pattern for the same thing everywhere, and the landing page |

**When to stop:**
- Round 3 has no blocker or major finding, and every minor finding is fixed or declined: freeze.
- If a blocker or major finding remains and there's time before the freeze, run round 4.
- Otherwise fix the blockers only, freeze, and list the rest in the exit note.

## The review
- **The reviewer is fresh each round.** It's a new agent given only:
  - the round's screenshots;
  - this rubric;
  - from round 2 on, the previous round's findings, so it can confirm each one is fixed.

  It never gets the code, the diff or the fixer's notes.
- **Its persona:** a hackathon judge with three minutes, who knows crypto a little and has never heard
  of Remora, Disc or x402.
- **For every page, it writes:**
  1. **The five-second answers:** what this page is for, and what you'd click first. If it can't say
     both, that's a major finding.
  2. **Findings**, each with the page, the state, the screen size, the severity, what's wrong and a
     suggested fix.
  3. **Words that could go,** quoted.
- **Then a cross-page section:** the same thing shown differently on two pages (an amount, a receipt,
  a remora's kind, a face, a status, an address).

**The rubric:**

| # | Check | What fails it |
|---|---|---|
| 1 | Purpose | No one-line purpose, or two things compete as the main action |
| 2 | Words | A block of prose longer than two lines (guide and chat content exempt); a sentence that repeats what a label or a picture already says; jargon outside ADR-0094 and ADR-0101's words |
| 3 | Data | A number that matters shown as a sentence; no unit or nothing to compare it with; the key number not the biggest thing; a raw address or digest with no short form, copy or explorer link; a date with no relative form |
| 4 | Hierarchy | More than three visual weights; a secondary action as loud as the main one |
| 5 | States | An empty state without a face, a line and a button; a spinner where a skeleton of the final shape fits; an error that doesn't say what happened and what to do, in 12 words or fewer |
| 6 | Consistency | The same thing looks different on two pages |
| 7 | Layout | Off the page column's grid; uneven rhythm; horizontal scroll at 412 px; a tap target under 40 px; something that matters hidden on a phone |
| 8 | Motion | Animation that shows nothing changing on an app page; a transition over 400 ms; motion that ignores reduced motion |
| 9 | Access | A visual-only fact with no text alternative; contrast below AA; no visible focus |

**Severity:**
- **Blocker:** wrong or misleading data, a broken layout, something unreadable.
- **Major:** fails the five-second test; a wall of text; the main action unclear; a sentence where a
  picture would be clearer.
- **Minor:** spacing, an inconsistency, a sentence that can go.
- **Nit:** taste. Nits never block the freeze.

## Where to start, page by page
These are starting ideas. The reviewer's findings decide.

| Page | Direction |
|---|---|
| Home (signed in) | A row of `Stat`s: remoras live, spent today against the limits, waiting for you, memories. "Needs you" as cards; recent activity as a `Timeline` |
| Home (signed out, in the app) | "What's a remora?" becomes a `Flow` (you → spending limit → remora → service → receipt) with one line, plus Try a Researcher |
| Chat, thread, room | The turn trace and payment chips as compact icons, the cost as a small `Receipt`, Why? as a visual receipt. Empty chat: a face and three example chips |
| Remoras | Cards: the face (its mood shows its state), the kind, a `Ring` for this month, the last activity. No description paragraph |
| A remora: Overview, Activity, Settings | `Stat`s and a `Meter`; Activity as a `Timeline`; rules as chips; Learning as a `Spark` per source plus a 👍/👎 bar; settings grouped, with `Hint`s |
| New remora | `Steps`; the budget as a `Meter` preview ("about N answers a month"); practice mode shown, not explained |
| Funds | Your USDC as a `Stat`; each spending limit as a `Meter` with the per-payment cap, payees as chips, a pause switch; Pause all is the one loud button |
| Approvals | The amount big, the payee, a one-line reason, two buttons. Paid becomes a `Receipt` |
| Memory | Chips by kind with counts; rows with an `ExpiryBar`; matched writes as a count badge; search |
| Verify, `/p/:token` | Paste or open a receipt, then `Checks` light up: found on Sui, amount, payee, answer hash |
| Playground | `Steps` (Start → Ask → Pay → Verify) with a `Flow` of the 0.01 USDC payment; then the answer and its `Receipt` |
| Guide | Lead with the `Flow`; the five start steps as `Steps`; shorter paragraphs. Every `Hint` links here |
| Hatchery, a template | Cards: face, kind, one line. A template page: what it does as three icon bullets |
| Import, share | `Steps` |
| Status | A `StatusDot` per part; Tatum's 402 shows "fallback serving" as a state, not a paragraph |
| Services (`/reef`) | Tiles: the name, a price chip, the number of calls |
| Connections | Tiles with a status dot, one line each |
| Settings, onboarding, connect, sign-in, Not found | Grouped fields, `Steps` and centered cards. Not found gets a face and one line |
| Landing (`/`, `/about`) | Already v2 (ADR-0102). Fix only what the review finds, and keep the shader |

## Tests
- **The e2e specs keep what they assert.**
  - A spec that selects by a visible text that's gone moves to a role name that still exists, or to a
    `data-testid`. Do it in the same commit, and say why in the message.
  - Never loosen an assertion, and never delete a check.
  - Prefer keeping the accessible name. A visible label should still be part of the button's name.
- **The video's capture marks and boxes** in `demo.spec.ts` keep their names, so `demo.html`'s cut
  still holds. Update the locators behind them.
- **Unit tests** that assert copy or classes assert behaviour instead.
- **New pieces get component tests** (Part B).

## Part D: freeze, merge, then the video
1. **Exit gates** on the branch:
   - typecheck, lint, test and build are green. Write down the bundle size before and after; the main
     chunk grows by 60 KB gzipped at most.
   - e2e: `smoke`, `mobile` and `AUDIT=1` audit are green. The testnet specs (`testnet`, w2, u6, u8,
     u12, `demo`) run once. Name any blocker, such as Tatum's 402 or the burner's USDC.
   - The final shots refresh `docs/e2e/screenshots/audit-*`.
2. **Merge the PR,** then pull `main`.
3. **The video** ([pipeline](../launch/demo/README.md)):
   1. Re-capture: `DEMO=1 bun run --filter @remora/e2e e2e -- --project=demo`. It spends a few cents of
      the burner's testnet USDC.
   2. **Put `demo.html` through the same rubric:**
      - one caption at a time, 10 words or fewer;
      - the explainer scenes ("where the money goes", the attack) use the kit's look (`Flow`,
        `Checks`, `Meter`), so the video and the app match;
      - 150–180 s in total (the form asks for 2–3 minutes).
   3. **Review before the render.** Make a contact sheet (`render.ts --sheet 12`) and drafts of the
      changed scenes (`--from … --to … --sub 1 --fps 30`). A fresh reviewer checks them; fix what it
      finds.
   4. **The full render** runs in the background: `render.ts --workers 8`, 4–5 hours here.
   5. **Check the output:** the duration, a new contact sheet you look at, and no missing-mark
      warnings.
4. **The landing page:**
   - Re-shoot `apps/landing/public/screens/*.jpg` from the final run: the same five names, 1440 dark,
     JPEG.
   - Its demo video becomes the new `remora-demo-web.mp4`.
5. **The deploy:** ask Uy, and wait for a yes. If Uy is away, leave the exact commands in the exit note
   and stop.
   - The commands: `vercel build --prod && vercel deploy --prebuilt --prod` from `apps/web`.
   - If the upload crawls, use the upload workaround from the Nov 3 deploy.
   - After the deploy: `e2e:main` on <https://getremora.vercel.app>, and one playground answer.

## Finish
- **`docs/spikes/<date>-u14-exit.md`:**
  - the word table, round 0 against the final round, per page;
  - each round's counts by severity;
  - what was declined, and why;
  - the bundle sizes and the gates;
  - the video's duration and render time;
  - data the visuals wanted but the API doesn't return;
  - the list for Uy.
- **An exit ADR** if the result differs from ADR-0103 or replaces parts of ADR-0095. Supersede them;
  never rewrite them.
- **Update these docs:**
  - `docs/ux/README.md` (the kit, the rubric);
  - the demo README's scene table;
  - `docs/launch/submission-draft.md` (the video line);
  - the README screenshots;
  - the goals README row.
- **A landed handoff to Huấn:** what changed, the selector moves, and the kit.
- Stop every server you started.

## Done when
- [ ] `pre-u14-ui` is tagged, and the PR is merged to `main`.
- [ ] Rounds 0 to 3 are recorded in `docs/ux/review/`. The last round has no blocker or major finding,
  and every minor finding is fixed or declined with a reason. If the time box stopped it, the rest is
  listed.
- [ ] The interface words across all pages are at least 40% below round 0.
  - No app page has more than 60 interface words above the fold at 1440×900 (the guide: 120), unless
    the exit note says why.
- [ ] typecheck, lint, test, build, e2e `smoke`/`mobile`/`audit` and CI are green, and the testnet
  specs ran once.
- [ ] The video is re-rendered from the frozen app (150–180 s, contact sheet checked), and the
  landing's screens and video are replaced.
- [ ] The exit note, the docs and the handoff are written and pushed. The deploy is done after Uy's
  yes, or its commands are waiting in the exit note.

## Never
- **Fake numbers in the app:** every number comes from the API.
- **Deleting an explanation a newcomer needs** without moving it into a `Hint` or the guide.
- **Changing these:** `packages/schema`, `lib/api.ts`, `routes.tsx`'s routes, the data hooks' logic,
  or any server API. List the data you wanted instead.
- **A new dependency without an ADR.** No WebGL in the app.
- **Ported code outside `apps/web/src/openbot/`,** or the kit inside it.
- **Loosening or deleting a test assertion.**
- **Committing Uy's uncommitted Hunch files.**
- **The usual:**
  - a deploy without Uy's yes;
  - mainnet money or a mainnet publish;
  - `db:push`;
  - a force-push;
  - secrets or `.env` values in a commit;
  - editing `reference/`;
  - killing processes on ports 8787 or 5173.
