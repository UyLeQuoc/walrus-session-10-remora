# Handoff: chat model choice needs server support (Huấn → Uy)

**Date:** 2026-10-19 · **From:** Huấn (web, Phase 6 §4) · **To:** Uy (server)

## What is already live in the web app

The chat composer now has a model picker. It sends an **optional** `model` field in the `/api/chat`
request body:

```jsonc
{
  "text": "…",
  "conversationId": "…",
  "clientMessageId": "…",
  "regenerate": false,
  "model": "anthropic/claude-haiku-5.5"   // omitted when the Remora default is selected
}
```

The picker is `apps/web/src/features/chat/model-picker.tsx`; the catalog (10 entries, snapshot of
OpenRouter 2026-10-19, USD per 1M tokens, every one supports tool calling) is
`apps/web/src/features/chat/models.ts`. The choice is stored in `localStorage` under
`remora.chat-model` (default `""` = Remora default). The body is built in
`apps/web/src/features/chat/use-chat-thread.ts` (`prepareSendMessagesRequest`); `lib/api.ts` is
untouched.

Listed as **Needs contract PR** in `docs/ux/ui-polish-progress.md` (Phase 6 §4).

## What the server needs

1. **Accept `model` in the chat body.** `apps/server/src/routes/chat.ts` should extend `chatBody`
   with `model: z.string().optional()` (or `z.enum(MODEL_IDS).optional()`). Today `zod` strips
   unknown fields, so the field is silently dropped and nothing breaks — the picker just has no
   effect yet.
2. **Allowlist it.** Validate against the same ids as the catalog. Preferred: export the ids from
   `packages/schema` (contract PR) so web and server cannot drift; a copied list is acceptable if
   you would rather not touch the shared package, but comment the source of truth.
3. **Pick the model per request.** Build `openrouter.chat(id)` for the requested id (falling back to
   the default `google/gemini-2.5-flash` on absence or an unknown id), instead of one client built at
   boot.
4. **Keep the existing fallback and logging.** Log `model.id` per turn as today; do not add a new log
   line shape.

No other client change is needed. Changing the model mid-conversation is allowed by the picker
(it applies to the next turn).
