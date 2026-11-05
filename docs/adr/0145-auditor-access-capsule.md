# ADR-0145: Auditor access: lend an auditor a remora's Wakes through a capsule, checked in their browser

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
U19 B1 (G7) asks that an owner lend an auditor read access to a remora's Wakes for a while, then take it
back, and that the auditor can check every claim without trusting us. ADR-0130's `remora_capsule`
already does the hard part: a shared object `{owner, grantee, key_id, blob_id, count, expires_ms,
revoked}` whose `seal_approve` releases a Seal key only to the grantee, before expiry, while it isn't
revoked. The deployed package shouldn't change.

## Decision
- **No Move change.** An auditor share is a `remora_capsule` capsule with the auditor as the grantee.
  The owner signs `capsule::create`; revoke is the capsule's own `revoke`, one owner signature.
- **The Wake bundle** (`AuditBundle` in `packages/schema/src/audit.ts`), built by the server
  (`apps/server/src/runtime/audit.ts`) as canonical JSON:
  - only that remora's receipts on its network inside `[from, to)`, oldest first, at most 500;
  - per Wake: the stored Wake (intent: trigger, input hash, cited memories, model, decision and its
    reason, Sonar's verdict and reasons; result), its intent hash, the payment's fields (digest, amount,
    payee, `payTo`, coin), the cited memory blob ids and, for a Wake that didn't pay, its Merkle proof
    from the `wakes.anchored` batch (ADR-0139);
  - the owner's question text only when the owner ticks "include question text" (off by default).
- **Sealing:** a fresh 32-byte key id per share; the Seal id is that key id itself (which
  `seal_approve` requires), under the capsule package and the same 2 of 2 open testnet key servers as
  ADR-0130 (`sealToFreshKey` in `packages/memory`). The ciphertext goes to the Walrus testnet publisher
  for the days plus one.
- **The auditor:** an address or a `.sui` name, resolved over gRPC NameService (ADR-0144). 1 to 30 days.
- **Records:** the confirm reads the transaction (success, sent by the owner, a `CapsuleCreated` event
  of our package with the draft's grantee, blob, count and expiry) and records an `action` event with
  `payload.kind` `audit.shared`; the revoke confirm checks a `CapsuleRevoked` for that capsule and
  records `audit.revoked`. They are `action` events, not new event types, because the feed's types are a
  closed list (`FEED_TYPES`). No new table.
- **Routes** (`audit-routes.ts`): owner only, `GET/POST /api/remoras/:id/audits`, `…/audits/confirm`,
  `…/audits/:capsuleId/revoke` and `…/revoke/confirm`. Public: `GET /api/audit/:capsuleId` returns only
  the blob id, key id, package, network, the remora's name, the auditor, the count, the range and the
  expiry. No plaintext leaves the server except sealed, on Walrus.
- **The auditor's page** `/audit/:capsuleId`, no account: connect a testnet wallet, sign a Seal
  `SessionKey`, fetch the blob from the Walrus testnet aggregator, decrypt in the browser
  (`decryptCapsuleBlob` in `apps/web/src/lib/seal.ts`, gRPC-web). The bundle is parsed with its schema and
  rendered as text only. Every paid Wake is checked against its transaction read from Sui on the page:
  the intent hash recomputed there, a `Paid` event carrying it, its amount and payee, the balance change
  to `payTo`, and the remora's key as the sender ("N of N receipts match Sui"). Each anchored Wake shows
  B2's proof card, which checks its root against the `Anchored` event itself. A refusal by the key
  servers reads "Access was revoked or expired: the key servers refused."
- **The owner's card** "Share with an auditor" sits on the remora's Activity tab: range, auditor,
  days, the include-questions switch, then the link and a Revoke button.

## Consequences
- An auditor can check a remora's decisions and payments end to end without an account and without
  trusting our server: Seal and the capsule enforce access, and the chain backs every receipt.
- The bundle is the owner's claim. A Wake the owner leaves out isn't in it; the page can only check
  what it holds. Revoking ends future reads, not what an auditor already saw or saved.
- The intent includes hashes of the inputs and prompt, and the decision's reason (model prose); an
  owner sharing Wakes shares those too. Question text needs the explicit switch.
- Testnet only (ADR-0024): a mainnet pass needs a mainnet capsule package and mainnet key servers.
- Live check, Nov 5 on testnet (the server's functions on the local DB): the burner shared its
  Researcher · u19's 29 Wakes of Nov 5 with burner2: create `3V6cNFcCidMf9Ziz3eTZCTTwmkfhbAFM3MdUVLwMM4dK`,
  capsule `0x76576edd19794c1916733c749dd0471df94e88b5020babd56c7e72689703baff`; burner2 decrypted, 14 of
  14 receipts matched Sui and 15 of 15 anchored Wakes reached their root; the burner (not the grantee)
  was refused; revoke `HFGW3ysSLEEcxbWCC2WsnrtmDrMHTqHiYJ92yLp2wELK`; burner2 was then refused
  (`NoAccess`). 0.0045 SUI of gas.

## Links
- ADR-0130 (capsules), ADR-0139 (anchors), ADR-0144 (`.sui` names), ADR-0134 (U19).
- `packages/schema/src/audit.ts`, `apps/server/src/runtime/audit.ts`,
  `apps/server/src/runtime/audit-routes.ts`, `apps/web/src/features/audit/`,
  `apps/web/src/lib/seal.ts`, `e2e/tests/u19-b1.part.ts`.
