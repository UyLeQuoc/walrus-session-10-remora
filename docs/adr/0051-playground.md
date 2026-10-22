# ADR-0051: The playground: a $1 Disc per visitor, no memory budget, and an onchain end

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Uy (instructions), Uy's agent (goal U8)

## Context
H7 lets judges *use* Remora without a wallet: "Try Scout" with a $1 Disc, rate-limited and retired after 24 hours (spec §12.8). Three constraints:
- the operator account's relayer budget is about 1000 weighted requests an hour, and the U7 exit used it up (ADR-0049);
- nobody owns a playground Scout, so there's no one to approve or sign;
- on testnet Uy wants one test wallet for everything: "use the key already in env, one wallet for all".

## Decision
- **The funder:**
  - the server signs with `PLAYGROUND_FUNDER_KEY`;
  - locally and in the e2e it's the burner's key (`E2E_BURNER_KEY`), passed in, never copied into `.env`;
  - on mainnet the playground is off until the mainnet pass (U9) gives it its own funded key.
- **One Scout per visitor:**
  - created like any Scout, owned by the funder, and flagged `remoras.playground = true`;
  - flagged remoras never appear in an owner's lists, rooms, teams, proposals or approvals; the funder's panic still covers them, for safety;
  - it starts **live**, because the Disc is the safety: ADR-0012's shadow mode is for templates.
- **The Disc:**
  - lifetime cap **1 USDC**, at most **0.05 a payment**, payees from the network's Reef only;
  - the allowance **expires onchain at the session's end**, so it stops spending even if the expiry job never runs;
  - the funder signs the issue, and pays the gas for the issue and the revoke.
- **Limits**, each overridable by env (`PLAYGROUND_*`):
  - 3 questions per session;
  - 3 new sessions per IP per UTC day (the IP stored as an HMAC with `SESSION_SECRET`);
  - 10 live Scouts in the pool;
  - a 24-hour TTL.
  - An over-limit ask is refused in plain words. A purchase over the cap is blocked, because there's no owner to ask.
- **Funder check:** before a session, the funder needs at least 0.10 USDC and 0.02 SUI. Otherwise the playground says it's resting, and health reports it degraded.
- **The end:**
  - a `playground.expire` job, queued for the TTL, revokes the Disc (the funder signs) and retires the Scout, recording the digest;
  - it's idempotent.
- **Memory: off by default.**
  - Playground Scouts don't recall and don't write, so they cost the relayer budget nothing.
  - Their Wakes stay in Postgres and verify at `/verify`, and paid ones are anchored onchain by `Paid.intent`.
  - If `PLAYGROUND_MEMWAL_ACCOUNT_ID` and `PLAYGROUND_MEMWAL_PRIVATE_KEY` are set, they use that separate account instead.
  - They never use the operator's account or any owner's namespaces.
- **Sessions:**
  - a random token, kept as a SHA-256 hash in `playground_sessions`;
  - the browser holds it in the `remora_playground` cookie, with an `x-remora-playground` header cross-origin;
  - the session API is public and answers only for its own token.

## Consequences
- A visitor's worst case is the funder's 1 USDC, enforced by the Disc onchain. A burst of visitors is bounded by the pool and the per-IP limit, and the relayer isn't touched.
- The playground shows paying, answering and the Wake. Memory is shown in the signed-in product.
- U9 decides the mainnet playground: its funder key, its budget, and whether it gets a memory account.

## Links
- spec §12.8; ADR-0012, ADR-0024, ADR-0030, ADR-0049; `docs/goals/uy-08-launch-readiness.md`
