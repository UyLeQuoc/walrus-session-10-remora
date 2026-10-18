# Handoff: Uy → Huấn, copy for the new Disc error codes

- **Date:** 2026-10-19 · **From:** Uy (goal U2) · **To:** Huấn · **Status:** open
- **Why:** contract PR #3 adds six `ERROR_CODES`, so six new `error.<code>` copy keys. Copy lives in
  `apps/server/src/copy/` (your lane).

| Code | When it happens | Suggested sentence (edit freely) |
|---|---|---|
| `disc.not_owner` | someone other than the owner tried to change a Disc | "Only the owner can change this budget." |
| `disc.not_spender` | the remora's key isn't the Disc's spender, e.g. after a rotate | "This remora's key was replaced. It's using the new one now." |
| `disc.wrong_disc` | an allowance was paired with another Disc (a bug) | "Something didn't match on our side. Nothing was paid." |
| `disc.exists` | the owner reused a budget name that's still live | "You already have a budget with that name." |
| `disc.bad_intent` | the payment wasn't tied to a receipt (a bug) | "The payment wasn't tied to a receipt, so it was stopped." |
| `disc.outdated` | the Disc needs a migrate after an upgrade | "This budget needs a quick update before it can pay." |

The Move and validator errors behind each code are listed in `docs/spikes/2026-10-19-disc-testnet.md`
and `packages/disc-sdk/src/errors.ts`.
