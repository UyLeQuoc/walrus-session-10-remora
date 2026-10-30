# @remora/memory

Walrus Memory client: scopes and delegate keys, sponsored account transactions, recall and write policy (retries, dedupe), memory text grammar, credential redaction, untrusted-memory framing, rate limiter, `diagnose`. Ported from hippo; read `docs/tech-reference.md` §1.11 before changing it.

F15 ([ADR-0074](../../docs/adr/0074-memory-facts-and-admission.md)) adds two pure modules:
- `facts.ts`: the fact shape, `reconcile` (create, extend, supersede, dispute, history, skip by authority and effective time) and `currentAt` (what held at a date);
- `admission.ts`: `admit` (stale, repeats, caps, token budget) and `judgeAdmitted` (an optional model pass that only drops and fails open).

The server keeps the ledger (`apps/server/src/runtime/facts.ts`).

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** F1, F2, F4–F6, F11, F15, B3, B4
