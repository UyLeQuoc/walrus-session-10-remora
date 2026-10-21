# ADR-0044: Remora names for identity cookies, headers and the wallet sign-in text

- **Status:** Accepted
- **Date:** 2026-10-21
- **Deciders:** Uy (agent; from Huấn's handoff `2026-10-19-huan-to-uy-hippo-auth-strings`)

## Context
The UI no longer shows "hippo" (ADR-0036–0041, D10), but the identity layer still used hippo's names:
- the `hippo_session` and `hippo_guest` cookies;
- the `x-hippo-session`, `x-hippo-guest` and `x-hippo-channel` headers;
- the browser's `hippo.session` and `hippo.guest` keys;
- the wallet sign-in message, "Sign in to hippo.".

Cross-origin clients and live sessions depend on these names, so a rename has to be coordinated across server, web and E2E.

## Decision
- **Writes use Remora names:**
  - cookies `remora_session` and `remora_guest`;
  - headers `x-remora-session`, `x-remora-guest` and `x-remora-channel`;
  - browser keys `remora.session` and `remora.guest`.

  These live in one place, `apps/server/src/identity/names.ts`.
- **For one release, reads accept both.** The server reads the new cookie or header first, then the hippo one. CORS allows both header sets. A guest still on `hippo_guest` gets `remora_guest` set on their next chat. The web moves `hippo.*` keys to `remora.*` once, with the existing D10 migration in `lib/storage.ts`.
- **The sign-in text becomes "Sign in to Remora."** The server builds and verifies the same message, so no client checks the text.
- The memory namespaces (`hippo`, `hippo-guest:<id>`) stay as they are. They are on-chain layout (ADR-0005, ADR-0030), not branding.

## Consequences
- **Existing sessions keep working.** Signing out clears both session cookies.
- **Next release:** remove the hippo reads from `names.ts` and the CORS list.
- **E2E:** the W2 helper reads `remora.session` and sends `x-remora-session`.

## Links
- `apps/server/src/identity/names.ts`, `routes/{auth,chat}.ts`, `identity/session.ts`, `index.ts`, `apps/web/src/lib/api.ts`, `packages/memory/src/wallet.ts`
