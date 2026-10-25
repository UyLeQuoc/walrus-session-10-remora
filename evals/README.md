# evals/

LLM evals: the prompt-injection red-team suite, and the triage and source-scoring evals.

- **MCP attacks (F14, [ADR-0067](../docs/adr/0067-mcp-v2-details.md)):** `mcp-attacks.json` holds 10
  attacks an agent could send through `/mcp`. Each names the layer that must stop it, and none may pay.
  `apps/server/src/mcp/attacks.test.ts` runs them in CI, with the real routes, tools and Sonar policy and
  a fake chain.
- **The red-team suite (I3):** U9 builds it (`bun run evals`, at least 20 injection attacks). It can load
  this file too.

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** I3, K6·be, F14
