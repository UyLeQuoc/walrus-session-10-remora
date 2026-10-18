# apps/server/src/tools

The D4 tools a remora turn can use:

| Tool | File | What it does |
|---|---|---|
| `pay` | `pay.ts` | Buys from a Reef service through the Disc. Every call goes Sonar → Disc → Wake. Over the cap, it becomes an approval (E4). |
| `tatum.balances`, `tatum.objects` | `read.ts` | Reads the chain through Tatum gRPC. |
| `web.fetch` | `read.ts` | Fetches public pages only (`@remora/merchant` `fetchPage`). The result is untrusted. |
| `memory.recall` | `read.ts` | Searches the remora's namespaces (ADR-0030). |
| `schedule` | `propose.ts` | Only proposes. The owner approves in the inbox (N2). |
| `handoff` | `propose.ts` | Queues a question for another of the owner's remoras (`remora.ask` job). |

The model has no `memory.remember` tool. Memory writes are deterministic (Wakes, rules, source scores), so injected text can't plant memories (ADR-0032).

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** D4, D5
