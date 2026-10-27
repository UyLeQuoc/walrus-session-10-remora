# Goal U13: Remora's web in openbot's UI (the whole UI, ported under PolyForm Noncommercial)

- **Owner:** Uy's agent. It claims `apps/web` from Huấn ([ADR-0027](../adr/0027-flex-takeover.md),
  [claim note](../handoffs/2026-10-27-uy-to-huan-u13-claim.md)).
- **Runs in:** `/Users/uydev/orca/projects/walrus-session-10`, on the branch `u13-openbot-ui`, merged
  through a PR.
- **Decision:** [ADR-0069](../adr/0069-openbot-ui-ported-under-polyform.md).
- **Before U9:** Uy put the UI first ("fully UI trước").
- **Upstream:** `reference/openbot`, a read-only clone of `nightly-labs/openbot` at commit `aa3c498`.
  - Read its files only.
  - Never install, build or run anything inside it, Storybook included.

**Goal:** every page of Remora's web looks and behaves like openbot's web client: its tokens, shell,
roster, conversation, composer and panels. Remora's data, flows, copy, logo and every e2e selector stay.

## Before you start
- **Read:**
  - ADR-0069, plus ADR-0036, 0039, 0040, 0041, 0042 and 0068;
  - `docs/ux/README.md`, `apps/web/src/app/{routes,app-layout,app-sidebar}.tsx`, `apps/web/src/index.css`
    and `features/remoras/hooks.tsx`.
- **Upstream (paths relative to `reference/openbot`):**
  - `docs/ui-foundation.md` and `docs/web-client.md`;
  - `packages/brand/src/tokens.css` (dark) and `tokens-light.css`;
  - `packages/ui/src/styles/primitives.css` and `src/renderer/src/styles/app-shell.css`;
  - `src/renderer/src/features/web-client/` (`WebWorkspace.tsx`, `WebMobileNavigation.tsx`,
    `web-client.css`): this is the closest reference;
  - `packages/ui/src/features/{sidebar,conversation,agents,channels}/`;
  - the screenshots in `apps/auth-api/src/content/guides/media/openbot-101/`. Look at `a-channel.webp`,
    `a-thread.webp` and `pick-a-model.webp`.
- **Huấn's state:** pull `main` and check his branches, PRs and handoffs. If he has started something in
  `apps/web` since the claim, leave those files for last and write him a note.
- **Rollback point:** tag `pre-u13-ui` on `main` and push the tag.

## Part A: the license frame (first commit on the branch)
- **`apps/web/src/openbot/` is the only place for ported code:**
  - `LICENSE`: the full PolyForm Noncommercial 1.0.0 text, and both `Required Notice:` lines copied
    verbatim from upstream's `LICENSE`.
  - `README.md`: the upstream commit, and a table mapping each ported file to its upstream path(s).
  - A header comment in every file: `Ported from nightly-labs/openbot <path> @ aa3c498. PolyForm
    Noncommercial 1.0.0, see ./LICENSE.`
- **Update the root `README.md` License section and `THIRD_PARTY_NOTICES.md`:**
  - `apps/web/src/openbot/` is PolyForm Noncommercial; the rest is MIT;
  - add Inter (SIL OFL 1.1).
- **Never take openbot's brand:**
  - the logo, wordmark, app icons, the bloub blob avatars, marketing art;
  - provider logos and Font Awesome marks;
  - its i18n strings.
- **Remora's own pieces:**
  - **Logo:** Remora's (ADR-0040).
  - **Avatars:** Remora's own, for example a shape and colour derived from the remora's id, and the
    template's emoji.
  - **Copy:** Remora's own.

## Part B: tokens and primitives
1. **Tokens.**
   - Port openbot's tokens to `openbot/tokens.css`, both themes:
     - surfaces, text, borders, accent `#007cf7`, success, warning, danger, glass, data-table and chart
       colours;
     - type scale, radii, spacing, control heights, shadows, z-layers, motion, and the neutral focus
       ring.
   - Map shadcn's variables in `index.css` onto them: background, card, popover, primary, muted, accent,
     border, input, ring, destructive, success, warning, sidebar-* and chart-*. Every existing component
     then takes the new look.
   - Load Inter Variable from `@fontsource-variable/inter`.
   - Keep `remora.theme` (system, light or dark) and the no-flash script.
2. **Primitives (`components/ui`).**
   - Restyle what the app uses, following openbot's primitives:
     - button sizes 24/32/36/40 and a 0.97 press;
     - badge variants, inverted tooltip, sliding-pill tabs, switch, select, input and field;
     - dialog and menu motion, top-right toasts.
   - Keep the Radix behaviour, the `data-slot`s, the props and the roles.
3. **Shared CSS.**
   - Port pointer-only hover, `pointer-focus`, scroll-edge fades, hidden vertical scrollbars and
     reduced motion.
   - Fix the gaps the inventory found:
     - `.link` is used but never defined;
     - `ui/sonner.tsx` uses `next-themes` without a provider;
     - the webmanifest still uses the old teal;
     - the raw palette classes in `lab/health-board` and `threads/sidebar-team`.

## Part C: the shell
1. **Rail.** An icon rail as in openbot's PageRail:
   - Home, Chat, Approvals (with the pending badge), Funds, Memory, Connections, Hatchery and Settings;
   - at the bottom: Verify, Guide and the account menu.
2. **Left panel: the roster.**
   - **Size:** 280px by default, resizable from 128 to 400px. Below 110px it snaps to an 88px column of
     avatars. The width is saved in localStorage.
   - **Topbar:** `NetworkSelect` (keep `testnet-badge`), `PanicButton` and New chat.
   - **Search.**
   - **Sections:**
     - Waiting: remoras with a pending approval;
     - Remoras, as agent rows: avatar, name, a role chip (the template), the time, the last line, and
       an unread or approval badge;
     - Rooms, as channel rows with a 2×2 grouped avatar;
     - Try Scout, Hatchery and Import.
   - **A context menu per row.** Recents and their search keep working.
3. **Main pane.**
   - Chats, threads and rooms are conversations.
   - Every other route renders as a page in the main pane. `Page` and `PageColumn` keep their
     `data-slot`s, and the h1 left-edge invariant holds.
4. **Right panel.**
   - Docked and resizable, with tabs.
   - It holds the remora's profile and settings, the memory panel, Why? and Wake details, and verify.
   - On a phone it opens full width under the header.
5. **Phone (≤720px).**
   - openbot's web-client layout: a bottom nav (Chat / Workspace) and one pane at a time.
   - The sign-in button is reachable without opening anything.
   - No horizontal scroll at 375px or on a Pixel 7.
6. **Cmd/Ctrl+K.** Restyle Huấn's command palette as openbot's GlobalSearch: remoras, rooms, pages and
   actions. Add Connections, which is missing.

## Part D: the conversation and the composer (`/chat`, `chat/r/:id`, `chat/room/:id`)
- **Header:** the avatar or grouped avatar, the name, a model picker in the style of
  `ProviderModelPicker`, and actions.
- **Timeline:**
  - day markers and the unread marker;
  - user bubbles on the right, on the inverted surface;
  - agent rows on the left, with an avatar and a coloured name;
  - reply quotes, hover actions, typing dots and activity, and scroll to latest;
  - the empty state, with the ASCII ocean recoloured.
- **Remora's blocks in openbot's forms:**
  - the turn trace becomes AgentSteps ("n steps · Memory: k saved");
  - payment chips (`thread-chip[data-type=payment]` with Why?) become ChatActionMarkers;
  - the inline approval becomes an ApprovalCard. It's a click, not hold-to-confirm, and the button
    names stay;
  - the route label ("<name> · named"), "Learned: …" and the remembered list.
- **Composer:** openbot's shape (rounded field, `+` menu, model chip, send and stop), restyling the slash
  menu and the mention popover. Keep:
  - the label "Message";
  - `aria-label="Ask your remora"`;
  - the placeholder "Message your remora…";
  - Enter to send.
- **Markdown:** keep our renderer and style it like openbot (code blocks with copy, tables, chips).

## Part E: every other page
Restyle each page in openbot's page, settings and data-table style:
- Home/dashboard, the remoras list, the remora page (Ask, Rules, Learning charts, Settings, Retire) and
  the new-remora wizard;
- Funds (Discs, panic), Approvals (ApprovalCards), the Memory inspector (data tables), Connections and
  Settings;
- the Hatchery (gallery, template, share), Import, Verify, Guide, Playground, Onboarding, Connect, Lab,
  Not found;
- sign-in: a centered card in the style of `AccountLogin`, with Remora's wallet picker.

Charts use recharts with openbot's chart tokens.

## Part F: tests
- **Every e2e selector stays:**
  - the test ids, labels, role names and texts in `e2e/tests/*.spec.ts`;
  - the Radix attributes on the network menu;
  - the 1440px h1 left edge and the gutters, measured through `[data-slot=page-column]` and
    `[data-slot=sidebar-inset]`.

  If a layout invariant has to change, update the spec in the same commit and say why.
- **Unit tests that assert Tailwind classes** (`app/pages.test.tsx`, `components/app/page.test.tsx`,
  `copy-button.test.tsx`): make them assert behaviour or the new classes. Never drop a behaviour check.
- **Add component tests** for the resizer snap, the compact roster, the bottom nav, the roster sections
  and the right panel.

## U13 exit
Run it once, and re-run only a fixed step.
1. typecheck, lint, test and build are green. Note the bundle size before and after.
2. **e2e:**
   - `smoke` and `mobile` are green;
   - `AUDIT=1` audit is green;
   - the testnet specs (w2, u6, u7, u8, u12) run once. If Tatum's 402 or the burner's USDC blocks a
     spec, name the blocker and run the rest.
3. **Screenshots** of every route at 1280 and 375px, light and dark, saved to
   `docs/e2e/screenshots/u13-*`.
   - Open each one and look at it.
   - Put a side-by-side of the chat and the room next to openbot's `a-channel` and `a-thread`.
4. **Keyboard and accessibility:** Cmd/Ctrl+K, Tab order in the shell, reduced motion, and the N18
   labels kept.

## Finish
- **Record `docs/spikes/<date>-u13-exit.md`:**
  - what was ported, from which upstream files;
  - what wasn't, and why;
  - the screenshots and the checks;
  - the list for Uy.
- **Update:**
  - `docs/ux/README.md`, with how to build a page in the new kit;
  - the README screenshots;
  - the goals README.
- Write a landed handoff to Huấn.
- Merge the PR when it's green, then stop every server.

## Done when
- [ ] The PR is merged to `main`, and `pre-u13-ui` is tagged.
- [ ] The exit passes, or each failing step names its blocker.
- [ ] typecheck, lint, test, build, e2e smoke/mobile/audit and CI are green.
- [ ] The license frame, docs and handoff are written, and everything is pushed.

## Never
- A deploy, mainnet money or a mainnet publish.
- **Ported code outside `apps/web/src/openbot/`, or a ported file without its header.**
- openbot's brand, avatars, artwork or copy.
- Running openbot's code.
- Changing `packages/schema`, `lib/api.ts`, `routes.tsx` or the data hooks' logic.
- Editing `reference/`.
- Rewriting an accepted ADR, or a decision without an ADR in the same commit.
- Force-pushing, or committing `.env` or keys.
