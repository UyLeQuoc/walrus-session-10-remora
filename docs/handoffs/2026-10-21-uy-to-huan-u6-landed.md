# Landed: the Grok-bots shape (goal U6): remoras you chat with, rooms, a model each, teams from Markdown

- **Date:** 2026-10-21
- **From:** Uy's agent (goal [U6](../goals/uy-06-grok-bots-shape.md); the claim is [u6-claim](2026-10-21-uy-to-huan-u6-claim.md))
- **To:** Huấn
- **Status:** landed on `main`

## What you can use now

**Contract (PR #7, [ADR-0042](../adr/0042-grok-bots-shape.md)).** These shapes are in `packages/schema`, each with a fixture:
- `MODEL_CATALOG` (`models.ts`): five OpenRouter ids at most $1 per 1M tokens, all with tool calling. This is now the source of truth for `features/chat/models.ts`.
- `RemoraConfig.model?`;
- `Room`, `RoomMessage`, `RoomResponder`, `RoomRoute` (`rooms.ts`);
- `TeamFile`, `TeamPreview` (`team.ts`); `fixtures/team.example.md` is a full team file;
- `FEED_TYPES` + `message`;
- `Schedule.paused`;
- `OwnerSettings.telegramLinked`.

**API.**

| Route | What it does |
|---|---|
| `POST /api/remoras/:id/messages {text}` | The owner's line in a 1-1 thread. Scout answers (it may buy first). Sentinel learns a rule, or says what it watches |
| `GET /api/feed?remora=&order=asc&after=` | The thread, oldest first. Approval events carry `status`, `kind`, `amount`, `payee` and the schedule's `human`/`question`, so the card renders inline |
| `GET/POST /api/rooms`, `PATCH /api/rooms/:id {responder, leadId, memberIds, name}` | Rooms. Each owner and network has a default **Team** room with every live remora (its members can't be edited) |
| `GET/POST /api/rooms/:id/messages` | The room. A post returns `routedTo` and `route` (`mention`, `everyone`, `signal`, `auto`, `lead`, `none`) |
| `POST /api/teams/preview`, `/apply`, `/confirm`; `GET /api/teams/export` | Teams from Markdown. Apply returns **one** owner transaction for every Disc |
| `PATCH /api/remoras/:id {model}` | A catalog id, or `null` for the default |
| `POST /api/remoras/:id/schedules/:scheduleId/pause` or `/resume` | Imported schedules arrive paused |
| `POST /api/chat {model?}` | Your handoff: a catalog id for the turn |

**Web (`apps/web`).** These are the new items I claimed. Nothing else changed behaviour.

| Where | Items |
|---|---|
| Sidebar | **Remoras** (contacts: initial, status dot, opens the thread) and **Rooms** (+ new room), below your existing items |
| `/chat/r/:id` | `features/threads/thread-page.tsx`: the 1-1 thread. It has the model picker in the header, chips for payment, block, shadow and rule learned, inline approval and schedule cards, and Why? and 👍/👎 |
| `/chat/room/:id` | `room-page.tsx`: members, "Who answers" (Mentions / Lead / Auto), "Lead", `@` autocomplete, and a route label under each owner line ("→ Scout · matched") |
| `/remoras/import` | `features/teams/import-page.tsx`: paste or upload, then Preview, then "Create the team (one signature)". If the server can't see the transaction yet, "Check again" retries it without a new signature |
| `/remoras` | Export and Import buttons |
| `/remoras/:id` | A "Brain" section with the model select; a Chat button; Pause/Resume on schedules |

**Shared pieces.**
- `features/threads/lines.ts` turns feed events and room messages into one `Line` shape.
- `thread-view.tsx` renders them. Remora bubbles use your `features/chat/markdown.tsx` unchanged, and self-asked answers show "Re: <question>".
- `inline-approval.tsx` is the N2/E4 card. Pay once is signed with `useSignTransaction`, and the merchant executes it.

**Identity rename ([ADR-0044](../adr/0044-remora-identity-names.md)).**
- The cookies are now `remora_session` and `remora_guest`; the headers are `x-remora-session`, `x-remora-guest` and `x-remora-network`.
- The localStorage keys are `remora.session` and `remora.guest`.
- The old hippo names are still read for one release.

## The U6 exit (Phase C)
It passed on testnet: [docs/spikes/2026-10-21-u6-exit.md](../spikes/2026-10-21-u6-exit.md) has the timings and digests.

What it changed is in [ADR-0045](../adr/0045-u6-exit-fixes.md). These parts touch the UI:
- the import page's "Check again";
- a room's signal goes to the room's lead first;
- a remora that fails in a room still shows a system line, and the server now logs it (`room.remora_failed`).

## Still yours (not claimed)
- **Visual design and copy voice** of the new pages. They use your `components/app/*` kit, `Bubble`/`Message` and first-draft sentences.
- **SSE.** Threads and rooms poll every few seconds, like the feed.
- **Telegram rooms.** The bot still talks to one remora at a time. Rooms are web only.

## Notes for when you touch these pages
- **Test ids the e2e relies on:**
  - `thread-chip` (with `data-type`), `thread-owner`, `thread-remora`, `typing`;
  - `inline-approval`, `route-label`, `room-members`, `team-remora`.
- **Labels the e2e relies on:**
  - "Message", "Send", "Team file" (exact), "Preview";
  - "Create the team (one signature)", "Pay once (x USDC)", "Approved".
- **E2E.** `e2e/tests/u6.spec.ts` is the U6 exit on testnet (`--project=u6`). It imports a team, chats with Scout, uses the room, pays a card once, and retires both remoras at the end.
