# Move security (I6)

Remora's money and provenance live in two Move packages:
- [`remora`](remora/sources/disc.move): the Disc, Remora's limits on Sui's native app-bound allowance;
- [`remora_hatchery`](hatchery/sources/hatchery.move): template provenance.

This page states what each package guarantees, how the code enforces it, which test proves it, and how upgrades are governed. The system-level view is in [the threat model](../../docs/threat-model.md).

## `remora::disc` (E1, ADR-0003, ADR-0020, ADR-0025)

**Invariants.** Each one holds for every transaction and is tested.

| Invariant | Enforced by | Tests |
|---|---|---|
| Money leaves only to an allowlisted payee, within the per-payment cap | `pay` checks `payees` and `per_payment_cap` before minting the permit | `rejects_payee_not_on_allowlist`, `rejects_payment_over_per_payment_cap`, `money_only_reaches_allowlisted_payees_within_caps` |
| Lifetime cap, rate window, start and expiry hold | Sui's native allowance, which the Disc can't bypass | `rejects_payment_over_lifetime_cap`, `rejects_payment_over_rate_window`, `rejects_payment_before_start`, `rejects_payment_after_expiry` |
| Only the spender pays; only the owner changes the policy | `pay` needs the allowance's spender; owner functions check `sender == owner` | `rejects_payment_from_non_spender`, `non_owner_cannot_{pause,set_payees,raise_the_cap,rotate,revoke}` |
| A paused Disc pays nothing | `pay` checks `paused` | `rejects_payment_while_paused` |
| One Disc per live allowance, keyed (owner, name) | The registry refuses a taken key; `pay`, `rotate` and `revoke` check `(funder, name)` | `rejects_duplicate_key`, `rejects_allowance_of_another_disc` |
| Rotation locks the old key out | `rotate` moves spending to the new spender | `rotate_locks_out_the_old_key`, `rotate_moves_spending_to_the_new_key` |
| A payment names its Wake | `Paid.intent` must be a 32-byte sha256 | `rejects_intent_that_isnt_32_bytes` |
| Spending never changes the policy | `pay` doesn't write `payees` or caps | `spending_leaves_the_policy_untouched` |

**Permit guards.** `internal::permit<DISC>()` is minted in exactly three places:
- `issue`: the proposal's funder is the sender;
- `pay`: the native module checks the spender, and the Disc checks its policy;
- `rotate`: owner only.

Every DISC-bound allowance therefore comes through `issue`, and each live allowance has exactly one Disc.

**Errors** are clever errors with stable codes, mapped to `ERROR_CODES` by `@remora/disc-sdk` `toDiscError`.

## `remora_hatchery::hatchery` (M6, ADR-0047)

| Guarantee | Enforced by | Tests |
|---|---|---|
| A template's author, blob and parent never change | `Template` is frozen at publish | `publish_freezes_the_template_and_emits_published` |
| Lineage can be checked | `publish_derived` takes the parent *object*, not an id | `a_derived_template_records_its_parent` |
| Only the author deprecates | `deprecate` checks `sender == author` | `the_author_can_deprecate`, `a_stranger_cannot_deprecate` |
| Blob ids are bounded | 1 to 128 bytes | `an_empty_blob_id_is_refused`, `an_oversized_blob_id_is_refused` |

`fork` and `deprecate` only emit events: they never move value. Fork counts come from the checkpoint indexer.

## Versioning (I6)
- Every Disc object and both registries carry a `version`. Every entry point checks it against the package's `VERSION`:
  - `disc_tests::rejects_payment_through_an_old_version`;
  - `hatchery_tests::an_outdated_registry_blocks_{publish,hatching}`.
- `migrate_*` only moves forward, so anyone may call it, and there's no admin cap:
  - `migrate_brings_an_old_disc_forward`, `rejects_migrating_a_current_disc`;
  - `migrate_moves_the_registry_forward_once`, `migrate_refuses_a_current_registry`.
- A frozen `Template` can't migrate. It only has to be no newer than the package.

## Upgrade policy
- **Testnet:** the spike test key holds both `UpgradeCap`s.
  - Disc package `0xcc05…5d6d`;
  - hatchery package `0x68c7…e9a9` (publish `2hrYQwVdFNWr2UsT4UDC4NZjN1xv2sCznPF5ns2vk1f5`).
- **Mainnet (U9, Uy's call):**
  - both packages are published from reviewed commits;
  - both `UpgradeCap`s move to a multisig (Uy plus a backup key) in the same pass;
  - `DEPLOYMENTS.mainnet` is filled, and `bun run diagnose` must pass before any deploy.
- An upgrade that changes object semantics bumps `VERSION`. Objects are then migrated, never rewritten.

## How to check
```bash
(cd packages/move/remora && sui move test)    # 31 tests
(cd packages/move/hatchery && sui move test)  # 11 tests
bun run diagnose                              # every DEPLOYMENTS id onchain with its Move type
```
CI runs both suites on every push.
