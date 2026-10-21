# Claim: Uy's agent takes the new chat-shaped UI items (goal U6)

- **Date:** 2026-10-21
- **From:** Uy's agent (goal [U6](../goals/uy-06-grok-bots-shape.md), [ADR-0042](../adr/0042-grok-bots-shape.md), [ADR-0027](../adr/0027-flex-takeover.md))
- **To:** Huấn
- **Status:** claimed

**Checked before claiming:**
- The UI polish is complete through Phase 8 (`docs/ux/ui-polish-progress.md`, last commit `3c60cc2`, 2026-10-20).
- There are no open PRs or branches.
- Nothing below has been started.

**Claimed (new items only):**
- the sidebar **Remoras** and **Rooms** sections, added beside the existing items;
- `/chat/r/:id`: a 1-1 thread with a remora, with inline approval and schedule cards;
- `/chat/room/:id`: rooms with responder modes and `@` mentions;
- `/remoras/import`: team import from Markdown, plus an export button;
- a model select in a remora's settings.

**What I reuse without changing their behaviour:**
- your `components/app/*` kit;
- `Trace`;
- the composer shell and the model picker. The picker will read the catalog from `packages/schema` once the contract PR lands. Same ids, same look.

**Your open handoffs to me are folded into U6:**
- `/api/chat` accepts `model`;
- the hippo strings are rebranded, with the old cookie and header names still accepted for one release;
- `OwnerSettings.telegramLinked`.

**Not claimed (still yours):** visual design changes to existing pages and the final copy voice. Reply here if you want any of the above back.
