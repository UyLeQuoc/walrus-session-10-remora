# ADR-0068: MIT license for Remora, Receipts and Kitty

- **Status:** Accepted
- **Date:** 2026-10-25
- **Deciders:** Uy

## Context
- Receipts and Kitty have been public without a `LICENSE` since the split
  ([ADR-0065](0065-split-receipts-and-kitty-repos.md)). Without one, all rights are reserved and nobody
  may reuse the code.
- U9 left Remora's license to Uy before the repo goes public
  ([ADR-0017](0017-github-repo-private-until-submission.md)). It recommended Apache-2.0 and said MIT
  was fine.
- Remora vendors [ascii-sharks](https://github.com/stackedlol/ascii-sharks) in
  `apps/web/src/components/ascii-ocean/` ([ADR-0041](0041-ascii-ocean-empty-chat.md)).
  - It had no license when it was copied (commit `c521e24`), which is why ADR-0041 is still Proposed.
  - Upstream added the MIT license on Oct 24, 2026 (commit `a0074c1`, "Copyright (c) 2026 drewdi").
- The event rules let us keep our IP, and give the sponsors a license to review the work
  ([event-rules.md](../event-rules.md)). An open license doesn't conflict with that.
- On Oct 25, Uy chose MIT ("đổi sang MIT").

## Decision
- **All three repos are MIT.** Each has a `LICENSE` at its root that reads
  "Copyright (c) 2026 Uy Le and the Remora contributors".
  - This repo.
  - `UyLeQuoc/total-recall-receipts` and `UyLeQuoc/total-recall-kitty`, each with its own ADR-0068.
    The code they copied from Remora is under the same terms.
- **Third-party code keeps its own notice.** `THIRD_PARTY_NOTICES.md` carries ascii-sharks' MIT notice
  for the vendored ASCII ocean.
- **MIT, not Apache-2.0:** it's shorter, and someone copying one piece needs only the notice. Apache-2.0
  would have added a patent grant and change notes on modified files.
- **Remora stays private until submission** (ADR-0017). Its license applies once the repo is public.

## Consequences
- Anyone may reuse the code if they keep the notice. MIT gives no patent grant.
- ADR-0065's "no license yet" point is settled. Its status line points here.
- ADR-0041's license question is settled by upstream's MIT. ADR-0041 is Huấn's, so Huấn accepts it. When
  he next touches the vendored files, their source comments can cite `a0074c1`.
- U9 no longer needs to pick a license. Its goal and prompt are updated. Phase E still writes the
  README's launch sections.
- New third-party code that requires a notice goes into `THIRD_PARTY_NOTICES.md` in the same commit.

## Links
- [LICENSE](../../LICENSE), [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)
- ADR-0017, ADR-0041, ADR-0065
- [Goal U9](../goals/uy-09-testnet-launch.md)
