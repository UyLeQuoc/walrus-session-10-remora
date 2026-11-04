# ADR-0130: Memory capsules: lend memories to another owner's remora through Seal, and take them back

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 A4, [ADR-0119](0119-u18-learning-loop-everyday-money.md))

## Context
Walrus Memory's own docs describe sharing an agent's knowledge with another agent. Remora's memory
lives in one operator account, under per-remora namespaces, so lending some of it to another owner's
remora can't be done by sharing the account or a delegate key without exposing everything. Seal
already decrypts Walrus Memory blobs for their owner (`apps/web/src/lib/seal.ts`), and Mysten runs
open-mode Seal key servers on testnet.

## Decision
- **A new Move package, `remora_capsule`,** published on testnet only (ADR-0024) with the spike key,
  like the hatchery:
  - package `0x7e14e6d59133307d8d8e28880b708f9e0f5f7f3399a4daaffb516feadf237e43`;
  - publish `5eCgTNkhxxvBvdjN1Dr5evuqogNUfboWDXjyqqN16Kk3`;
  - in `DEPLOYMENTS.testnet.capsulePackageId`.
- **The Capsule:** a shared object `{owner, grantee, key_id, blob_id, count, expires_ms, revoked}`.
  - `create` checks at most 30 days, a 32-byte key id and a non-empty blob.
  - Only the owner can `revoke`.
  - `seal_approve(id, capsule, clock)` aborts unless the sender is the grantee, the capsule isn't
    revoked or expired, and `id` is its key id.
  - 7 Move tests.
- **Encryption** (`packages/memory/src/capsule.ts`, no new dependency):
  - Seal, 2 of 2 of Mysten's open testnet key servers (`0x73d0…db75`, `0xf5d1…23c8`, checked
    onchain);
  - a fresh random key id per capsule;
  - the ciphertext goes to the Walrus testnet publisher for the lending days plus one.
- **Lending:**
  - the owner searches its memories (a recall, so the text is the stored text) and picks up to 20;
  - names a grantee (`@slug` of a remora on sale, or a remora's address) and 1–30 days;
  - signs one `create`.
  - The server re-reads the picked memories itself; the page never supplies their text.
- **Consent:** the grantee's remora gets an offer in its feed, and its owner is notified. Nothing
  reaches its turns until the owner accepts (`config.capsules`, a config version).
- **Reading:**
  - at answer time, the grantee builds a Seal session key signed by its own remora key
    (`RemoraSigner.signPersonalMessage`, new), and the key servers dry-run `seal_approve`;
  - the decrypted lines go to the model as untrusted data labelled `capsule from <remora>`;
  - the plaintext is never written to the grantee's memory. Only the ciphertext is cached, in
    process.
  - A revoked or expired capsule is refused by the key servers. The answer's note and the Wake's
    reason say so, and the answer event lists `capsules` with each read's result.
- **Revoke:** one owner signature. The next turn can't read it.

## Consequences
- An owner can share a remora's learning (source notes, rules) without sharing the account, and
  take it back. The enforcement is onchain and in Seal, not in our server.
- What a grantee's model already wrote in an answer stays in that answer. Revoking ends future reads,
  not past answers.
- Lender and grantee must both be remoras on this server, which signs as the grantee's own key.
- Testnet only. A mainnet pass needs a mainnet publish and mainnet key servers (Uy's call,
  ADR-0024).

## Links
- `packages/move/capsule`, `spikes/disc/capsule-publish.ts`, `packages/memory/src/capsule.ts`,
  `apps/server/src/runtime/capsules.ts`, `apps/web/src/features/remoras/capsule-card.tsx`.
- Spike, Nov 5 on testnet:
  - create `8KEd7G2hyV8qj8mYkWjSteK324VUiCgs9ugRLgJ371QJ`;
  - the grantee decrypted;
  - the lender was refused;
  - revoke `CAyFMGg6roAGtFapgns7fh26fakKLJ8zT1cZoZUWmgWX`;
  - the grantee was then refused.
