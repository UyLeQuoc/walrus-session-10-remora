# Landed: the Hatchery on Walrus, Proof of Learning, learning charts, memory controls (goal U7)

- **Date:** 2026-10-22
- **From:** Uy's agent (goal [U7](../goals/uy-07-hatchery-proof-of-learning.md); the claim is [u7-claim](2026-10-21-uy-to-huan-u7-claim.md))
- **To:** Huấn
- **Status:** landed on `main`

## What you can use now

**Contract (PR #8, [ADR-0046](../adr/0046-hatchery-team-files-and-learning-shapes.md)).** Each shape has a fixture in `packages/schema`:
- `SafetyReport` / `SafetyFinding`, `TemplatePermissions`, `ShareReview`, `HatcheryListing`, `HatchConsent`;
- `ProofOfLearning` / `DecisionRef`, `LearningSeries`;
- inspector rows gain `type`, `hiddenAt`, `supersededBy` and `expiresSoon`;
- `RemoraMemoryExport`;
- `Deployment.hatcheryPackageId`.

The Hatchery shares `remora.team/v1` files, so a remora is a team of one. `Template` stays as the catalog of built-in kinds.

**Move (PR #9, [ADR-0047](../adr/0047-hatchery-move-package.md)).**
- `remora_hatchery::hatchery` is its own package, published on testnet. Its ids are in `DEPLOYMENTS`.
- Templates are frozen. `Published`, `Forked` and `Deprecated` are its events.

**API ([ADR-0048](../adr/0048-u7-hatchery-learning-memory-runtime.md)).**

| Route | What it does |
|---|---|
| `POST /api/remoras/:id/share` | `ShareReview`: the exact file, its permissions, what was removed, and the safety report |
| `POST /api/hatchery/publish {markdown}`, `/publish/confirm {digest}` | Stores the file on Walrus testnet, then one owner transaction (`hatchery::publish`) |
| `GET /api/hatchery?q=&kind=`, `GET /api/hatchery/:id` | The gallery and one template, with its page and Telegram links. **Public, no wallet** |
| `GET /api/hatchery/:id/consent` | `HatchConsent`, read back from Walrus and reviewed again. **Public** |
| `POST /api/hatchery/:id/hatch`, `/hatch/confirm {digest, remoraIds}` | One transaction: every Disc issue plus `hatchery::fork`. Hatched remoras start in shadow mode |
| `POST /api/hatchery/:id/deprecate`, `/deprecate/confirm` | Author only |
| `GET /api/remoras/:id/proofs`, `GET /api/proofs/:before/:after` | Proof of Learning |
| `GET /api/remoras/:id/learning`, `GET /api/learning/export` | Learning series, and every remora's series as one JSON file for the blog |
| `GET /api/remoras/:id/memory?q=&ns=` | The inspector, now with `ns` to narrow a search |
| `POST /api/remoras/:id/memory/hide`, `/correct`, `/forget` | The owner's memory controls |
| `GET /api/remoras/:id/memory/export?format=json\|md` | The export |

**Claude Code (F9).** `packages/mcp` is a stdio MCP server with `remoras_list`, `remora_recall` (`remora:<id>:<namespace>`) and `wake_get`. Set it up with:

```bash
claude mcp add remora -e REMORA_SESSION=<session> -- bun <repo>/packages/mcp/src/bin.ts
```

**Web (the items I claimed).**

| Where | Items |
|---|---|
| Sidebar | A **Hatchery** link in the Remoras group (`features/threads/sidebar-team.tsx`) |
| `/remoras/:id/share` | `features/hatchery/share-page.tsx`: review → safety → "Publish to the Hatchery (one signature)" |
| `/hatchery` | `gallery-page.tsx`: search, a Scout/Sentinel filter, cards with fork counts and the safety label |
| `/hatchery/:id` | `template-page.tsx`: provenance (author, blob, publish tx), copy links, the consent screen, "Hatch it (one signature)", and Deprecate for the author |
| Remora page | A new **Learning** tab (`features/learning/learning.tsx`) with charts and Proof of Learning, plus "Share in the Hatchery" under More actions |
| Why? drawer | "What changed?" when the decision has a proof |
| `/memory` | Hide/Show and Correct per memory, forget all per namespace, the expiry alert and badges, JSON/Markdown export, and the "Use this memory in Claude Code" card (`features/memory-inspector/memory-controls.tsx`) |

## The U7 exit (Phase C)
It passed on testnet; [docs/spikes/2026-10-22-u7-exit.md](../spikes/2026-10-22-u7-exit.md) has the timings, blob ids and digests.

## Still yours (not claimed)
- **Visual design and copy** of the pages above. They use your kit, `Alert`, `Badge`, the shadcn chart, and first-draft sentences.
- **M12:** the "Hatch this remora" badge.
- **H6:** Walrus Sites.
- **The other W3 ·ui items.**

## Notes for when you touch these pages
- **Test ids the e2e relies on:**
  - `share-file`, `safety-report` (with `data-verdict`), `hatchery-card`, `fork-count`, `consent`;
  - `proof-delta`, `learning-series`, `memory-row`, `expiry-alert`.
- **Labels the e2e relies on:**
  - "Publish to the Hatchery (one signature)", "Hatch it (one signature)";
  - "Search the Hatchery", "Team file".
- **E2E.** `e2e/tests/u7.spec.ts` is the U7 exit (`--project=u7`). It uses a second browser context for the hatcher, a fresh test keypair funded with 0.05 testnet SUI by the burner.
