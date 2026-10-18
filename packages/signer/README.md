# @remora/signer

Envelope-encrypted remora keys (B4) and the gas sponsor's policy and co-signing (D8). Keys are decrypted only in here (ADR-0028).

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** B4, D8
- **`RemoraSigner`:**
  - `create(remoraId, network)`, `address`, `signTransaction`;
  - the secret is sealed with AES-256-GCM: a per-key DEK, wrapped by `KEY_ENCRYPTION_KEY`, with the remora ID as AAD;
  - the server stores it with `PgKeyStore` (`remora_keys`).
- **`Sponsor`:**
  - `inspect` refuses when the sponsor isn't the gas owner, is the sender or a funder, when the gas coin is used, when a package isn't allowed, or when the budget is over the cap;
  - `cosign` signs only after it inspects.
