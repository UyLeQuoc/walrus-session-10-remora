# Handoff: Huấn → Uy, rebrand the hippo auth strings the web can't reach

- **Date:** 2026-10-19 · **From:** Huấn · **To:** Uy · **Status:** open
- **Context:** the UI/UX polish (ADR-0036–0038, `docs/ux/ui-polish-plan.md` D10) removes every visible
  "hippo" on the web. Some of it lives server-side or in `packages/memory`, which is your lane.
  Please rebrand these.

**What still says hippo (verified by reading, 2026-10-19):**

1. **The wallet sign-in message.** `packages/memory/src/wallet.ts` `signInMessage()` returns
   `"Sign in to hippo."` as the first line. This is the exact string a wallet shows the user when they
   sign in, so a rebrand needs a matching change on any client that checks the text (none does today —
   the server verifies the signature only). Proposing `"Sign in to Remora."`.
2. **Cookies and headers** in `apps/server/src/routes/auth.ts`:
   - `SESSION_COOKIE = "hippo_session"`, `GUEST_COOKIE = "hippo_guest"`;
   - the fallback headers `x-hippo-session` (line ~85, ~101) and `x-hippo-guest` (line ~94).
   - Same names appear in `apps/server/src/routes/chat.ts` (`COOKIE`, `SESSION_COOKIE`,
     `GUEST_HEADER = "x-hippo-guest"`, `SESSION_HEADER = "x-hippo-session"`) and in
     `apps/server/src/identity/session.ts`.
   - Cross-origin clients read the session id from the `x-hippo-session` header (see the reply in
     `/api/auth/verify`), and `e2e/tests/w2.spec.ts` reads `localStorage["hippo.session"]` and sends
     `x-hippo-session`. Renaming is a coordinated change: server + the E2E helper. The web app itself
     does not read these names.
3. **CORS allow-list** in `apps/server/src/index.ts` includes `x-hippo-channel`, `x-hippo-guest`,
   `x-hippo-session`.
4. **Download fallback filename** `hippo-memory.json` (`apps/server/src/index.ts` comment) if you want
   it aligned with the export panel.

**Not in this handoff:** the lead namespace strings (`hippo`, `hippo-guest:<id>`) are a memory-layout
decision (ADR-0005 / ADR-0030) and are on-chain; leave them unless you are deliberately migrating.
The web only *displays* namespaces now, and the Chat tab relabels "guest" as "Not owned yet".

**What the web did already (for reference):** removed every displayed "hippo", moved storage keys
`hippo.*` → `remora.*` with a one-time migrate (`apps/web/src/lib/storage.ts`), and rewrote the four
`PAGE_META` descriptions and the guide.
