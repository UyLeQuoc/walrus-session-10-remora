# packages/move/remora

The Remora Move package: the `disc` module (app type `DISC` for app-bound allowances, ADR-0003 and ADR-0020), later the `hatchery` module (template provenance, ADR-0012), and their `sui move test` suites.

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** E1, I6, G2 (done in U2); M6, G4 later
- **Status:** `disc` v1. It has a `Registry` keyed by (owner, name), one shared `Disc` per allowance, `issue`, `pay` (emits `Paid` with a 32-byte intent), owner-only `rotate` / `set_payees` / `set_per_payment_cap` / `pause` / `revoke`, version checks and `migrate_*`. Events: `DiscIssued`, `Paid`, `DiscUpdated`, `SpenderRotated`, `DiscRevoked`.
- **Toolchain:** Sui CLI ≥ 1.81, pinned to 1.82.1 (ADR-0023). `sui move test` runs 31 tests, including invariants.

Every Move change gets a PR. Testnet publishes are allowed in Uy's goals; mainnet publishes are Uy's call (ADR-0024). IDs go in `packages/schema/src/deployments.ts` through a contract PR.
