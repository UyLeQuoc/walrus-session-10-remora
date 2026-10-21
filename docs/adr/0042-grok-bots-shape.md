# ADR-0042: Remora takes the Grok-bots shape: chat with remoras, rooms, a model each, teams from Markdown

- **Status:** Accepted
- **Date:** 2026-10-21
- **Deciders:** Uy

## Context
Grok Bot (xAI) and its open-source counterpart OpenMausBot (Apache-2.0, cloned read-only at `reference/openmausbot`) treat AI as a **messaging app**:
- a roster of bots you chat with like contacts, each with its own personality and model;
- rooms where several bots work together, with `@mentions` and an "auto" router that picks who answers;
- approvals as cards inside the chat;
- whole teams installed from one portable Markdown file.

Remora already has a roster of agents (Scout, Sentinel), but you reach them through dashboard pages and an "Ask" box. The chat at `/chat` is the hippo memory chat, not the remoras.

## Decision
- Remora adopts the shape. Each remora is a chat contact with a 1-1 thread. Rooms hold several remoras, with responder modes **Mentions / Lead / Auto**. Each remora chooses its model from one catalog. A team installs from, and exports to, one Markdown file with YAML frontmatter (`remora.team/v1`).
- **Remora's differences stay the point:**
  - each bot spends only through its Disc;
  - each decision has a Wake anchored onchain;
  - memory is on Walrus.
- Approval cards in a thread are those same E4 payments and N2 schedule proposals, not a new permission system.
- **Ideas borrowed from OpenMausBot, as behaviour, not code:**
  - room routing: mentions first, then a cheap decision model with a 0.6 threshold, falling back to the lead;
  - team files: they carry no secrets, imports start paused or in shadow, and the preview comes before any write;
  - one picker for the model per bot.
- Any code copied later keeps OpenMausBot's Apache-2.0 notice in `NOTICE`.
- **Not adopted:**
  - desktop apps and computer use;
  - Composio connectors, voice, and local agent CLIs.

  These are outside the Walrus × Tatum track and our stack.
- **New dependency:** `yaml` (eemeli/yaml, ISC, no dependencies) parses team frontmatter on the server.

## Consequences
- One contract PR adds:
  - the model catalog;
  - `RemoraConfig.model`;
  - the `message` feed type;
  - the room types;
  - the team file format;
  - `OwnerSettings.telegramLinked`;
  - `Schedule.paused`.
- New tables `rooms` and `room_messages`, pushed to local Docker only.
- The UI items are claimed from Huấn's lane (ADR-0027). His polish is complete, and nothing here was started.
- The goal and its exit e2e are in `docs/goals/uy-06-grok-bots-shape.md`.

## Links
- `reference/openmausbot/README.md`, `docs/decision-model.md`, `docs/team-sharing.md`, `docs/routine-schedules.md`
- ADR-0012 (templates carry no keys), ADR-0027 (flex takeover), ADR-0032 (W2 API), ADR-0033 (W2 contract)
