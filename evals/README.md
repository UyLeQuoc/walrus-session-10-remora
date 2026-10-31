# evals/

The red team: attacks on Remora's money and templates, each with the layer that must stop it. Nothing
may pay and nothing may publish.

**Run it:** `bun run evals`. It runs the three suites below and prints a table by layer, ending in
"N attacks, 0 overspends". CI runs the same suites in `bun run test`.

| File | What | Run by |
|---|---|---|
| `mcp-attacks.json` | 10 calls an agent could send through `/mcp` (F14, [ADR-0067](../docs/adr/0067-mcp-v2-details.md)): wrong scope, revoked or expired token, a payee outside the Reef, a swapped `payTo`, over the cap, another remora, a forged origin | `apps/server/src/mcp/attacks.test.ts`, with the real routes, tools and Sonar policy and a fake chain |
| `payment-attacks.json` | 12 payments an obedient model would make after reading injected text (I3, [ADR-0079](../docs/adr/0079-red-team-evals.md)): unknown or lookalike payees, a swapped or lookalike `payTo`, a raw address, over the cap, past u64, a paused Disc, a retired remora, a payee taken off the Disc, the zero address | `apps/server/src/runtime/attacks.test.ts`, through Sonar's deterministic policy |
| `template-attacks.json` | 6 poisoned `remora.team/v1` files (M7): instruction overrides, draining rules, memory exfiltration, watch lists, seed-phrase phishing, identity rewrites | `apps/server/src/hatchery/attacks.test.ts`, through the Hatchery's safety review |

**The layers after these.**
- **The check model.** It can only make Sonar stricter, so it isn't needed for these results.
- **The gas station's simulation.** It dry-runs every sponsored payment.
- **The Disc onchain.** With Sonar forced off, the injected payment reached the chain and the Disc
  aborted it:
  - `7NYf3QGEX8UEbU7nBhv1egC6tZFoUq23NWZZSjoLnpSV` on testnet (`EPayeeNotAllowed`);
  - see the [W2 exit](../docs/spikes/2026-10-19-w2-exit.md) §5;
  - to rerun it on demand on testnet: `spikes/w2/injection.ts`.

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** I3, K6·be, F14, M7
