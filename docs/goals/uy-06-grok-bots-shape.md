# Goal U6: the Grok-bots shape: remoras you chat with, rooms, a model each, teams from Markdown

- **Owner:** Uy's agent
- **Runs in:** the main checkout, on `main` (ADR-0022)
- **Depends on:** U5 (W2 on testnet), Huấn's UI polish (ADR-0036–0041)
- **Network:** money on testnet ([ADR-0024](../adr/0024-testnet-first.md)); memory on the mainnet relayer ([ADR-0026](../adr/0026-network-switch.md))
- **Reference:** `reference/openmausbot` (Apache-2.0, read-only, gitignored), the open-source Grok Bot
- **Decision:** [ADR-0042](../adr/0042-grok-bots-shape.md)

**Goal:** Remora becomes a messaging app of agents, the shape of Grok Bot. Each remora is a contact you chat with. Remoras share rooms. Each remora picks its own brain. A whole team installs from one Markdown file. Remora keeps what Grok Bot doesn't have: every bot spends only through its own Sui-enforced budget (Disc), and its memory and receipts (Wakes) live on Walrus.

> **U6 exit (testnet, Playwright + the burner):**
> - import a team from a `.md` file (Scout + Sentinel, a rule, a schedule) with **one signature for every Disc**;
> - chat 1-1 with Scout: it pays, answers in the thread, and the payment chip and **Why?** are inline;
> - in the team room, `@Sentinel` learns a rule, and an un-mentioned odds question is routed to Scout;
> - Scout's over-cap request shows an **approval card inline in the room**, and paying it once answers there;
> - Scout's answer is written by the model chosen for Scout, and its Wake records that model.

The UI part claims new UI items under [ADR-0027](../adr/0027-flex-takeover.md). Huấn's polish is done: there are no open PRs or branches. Claim note: [2026-10-21-uy-to-huan-u6-claim](../handoffs/2026-10-21-uy-to-huan-u6-claim.md).

## Contract PR (one, first)
Changes to `packages/schema`, each with a fixture:
- `MODEL_CATALOG`:
  - the chat/remora models, at most $1 per 1M tokens in and out, all with tool calling;
  - the source of truth for Huấn's `features/chat/models.ts`;
  - `RemoraConfig.model?` is one of its ids.
- `FEED_TYPES` + `message`: the owner's own line in a remora thread.
- `Room`, `RoomMessage`, `RoomResponder` (`mentions` | `lead` | `auto`).
- `TeamFile` (`remora.team/v1`, YAML frontmatter) and `TeamPreview`.
- `OwnerSettings.telegramLinked` (Huấn's handoff).
- `Schedule.paused`.

## Phase A: backend (each with tests)
1. **Model per remora (D9)** (`RemoraConfig.model`):
   - the brain builds the model per turn from the catalog; an unknown or missing id falls back to the default;
   - `PATCH /api/remoras/:id {model}`;
   - the Wake's `intent.model.id` is the model actually used;
   - also `/api/chat` accepts `model` (Huấn's handoff).
2. **Remora threads (1-1):**
   - `POST /api/remoras/:id/messages {text}` stores the owner's line as a `message` event.
   - Scout answers it (the `ask` path). Sentinel learns it if it parses as a rule, otherwise it answers with what it watches and its rules.
   - The thread is `GET /api/feed?remora=` (oldest first with `order=asc`).
   - Approval events carry the approval's state, so the web can render the card inline.
3. **Rooms:**
   - tables `rooms` and `room_messages`; a default **Team** room per owner and network holds every live remora.
   - `POST /api/rooms`, `GET /api/rooms`, `GET /api/rooms/:id/messages`, `POST /api/rooms/:id/messages`, `PATCH /api/rooms/:id {responder, leadId, members}`.
   - Routing:
     1. `@Name` mentions, then `@everyone`;
     2. a deterministic signal: a rule phrase goes to Sentinel; `0x…`, odds or a summary goes to Scout;
     3. in `auto` mode, the small model returns `{remora, p}`, used if `p ≥ 0.6`;
     4. otherwise the lead.
   - Each routed remora answers through its own path. Its events link back to the room message, and Sentinel pings also post to the room.
4. **Teams from Markdown:**
   - `POST /api/teams/preview {markdown}` parses and validates the file and writes nothing.
   - `POST /api/teams/apply {markdown}` creates the remoras, rules, schedules and room. All Disc issues go into **one owner PTB**, and confirm matches each Disc by name.
   - `GET /api/teams/export` returns the same format and never includes keys, memories, Disc/allowance ids or watched addresses.
   - Imported remoras start in shadow mode, and schedules arrive paused.
5. Rebrand the hippo strings that the web can't reach (Huấn's handoff). Cookies and headers keep accepting the old names for one release.

## Phase B: UI (claimed)
- **Sidebar:**
  - a **Remoras** section with remoras as contacts: initial avatar, status dot, last line;
  - a **Rooms** section;
  - existing items stay.
- **`/chat/r/:id` (thread):**
  - owner bubbles and remora bubbles;
  - chips for payment, block and shadow;
  - inline approval and schedule cards with Pay once, Approve and Decline;
  - Why?, 👍 and 👎 on remora lines;
  - typing while waiting;
  - a composer with the remora's model picker.
- **`/chat/room/:id`:**
  - members, the responder mode (Mentions / Lead / Auto) and the lead;
  - `@` autocomplete;
  - each line labelled with its remora;
  - the same inline cards.
- **`/remoras/import`:** paste or upload a `.md`, see the preview, create it with one signature. Export lives on the remoras list.
- **Remora settings:** a model select.

## Phase C: the U6 exit e2e (testnet)
- `e2e/tests/u6.spec.ts` covers the exit list above.
- Record timings and digests in `docs/spikes/2026-10-xx-u6-exit.md`.
- The model line needs a real `OPENROUTER_API_KEY`. Without one, record it as unverified and say so.

## Done when
- [x] Contract PR merged (#7).
- [x] A + B are done with tests.
- [x] `typecheck`, `lint`, `test`, `sui move test` (31/31) and `bun run e2e` (33/33) are green; CI is green.
- [x] The U6 exit passes on testnet, with timings and digests
      ([2026-10-21-u6-exit.md](../spikes/2026-10-21-u6-exit.md)).
- [x] The ADRs (0042–0045), docs and a handoff to Huấn
      ([u6-landed](../handoffs/2026-10-21-uy-to-huan-u6-landed.md)) are written; everything is pushed to `main`.

## Never
- Mainnet money. Real owner accounts in tests. Committing `.env` or keys. Deploying.
- Copying OpenMausBot code without its Apache-2.0 notice. Ideas only, unless attributed.
- Editing anything Huấn starts after this claim. Ports 8787/5173.
