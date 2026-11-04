/// U18 A4 (ADR-0130): a memory capsule. An owner lends a few of a remora's memories to another
/// owner's remora: the memories are Seal-encrypted to this capsule's key id and stored on Walrus, and
/// the Seal key servers release the key only while `seal_approve` holds: the caller is the grantee,
/// the capsule isn't revoked and hasn't expired. The owner revokes it with one signature; the next
/// decrypt fails, because the grantee never keeps the plaintext.
module remora_capsule::capsule;

use std::string::String;
use sui::clock::Clock;
use sui::event;

const ENoAccess: u64 = 1;
const ENotOwner: u64 = 2;
const EBadExpiry: u64 = 3;
const EBadKeyId: u64 = 4;
const EEmpty: u64 = 5;

/// The longest a capsule can be lent for: 30 days.
const MAX_LEND_MS: u64 = 30 * 24 * 60 * 60 * 1000;

public struct Capsule has key {
    id: UID,
    owner: address,
    /// The remora (its own key's address) that may decrypt.
    grantee: address,
    /// The Seal identity the memories were encrypted to (random, 32 bytes).
    key_id: vector<u8>,
    /// The Walrus blob holding the ciphertext.
    blob_id: String,
    /// How many memories it holds, for display.
    count: u64,
    expires_ms: u64,
    revoked: bool,
}

public struct CapsuleCreated has copy, drop {
    capsule: ID,
    owner: address,
    grantee: address,
    blob_id: String,
    count: u64,
    expires_ms: u64,
}

public struct CapsuleRevoked has copy, drop {
    capsule: ID,
    owner: address,
}

/// The owner lends `count` memories, encrypted to `key_id` and stored at `blob_id`, until `expires_ms`.
public fun create(
    grantee: address,
    key_id: vector<u8>,
    blob_id: String,
    count: u64,
    expires_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let now = clock.timestamp_ms();
    assert!(expires_ms > now && expires_ms - now <= MAX_LEND_MS, EBadExpiry);
    assert!(key_id.length() == 32, EBadKeyId);
    assert!(count > 0 && blob_id.length() > 0, EEmpty);
    let capsule = Capsule {
        id: object::new(ctx),
        owner: ctx.sender(),
        grantee,
        key_id,
        blob_id,
        count,
        expires_ms,
        revoked: false,
    };
    event::emit(CapsuleCreated {
        capsule: object::id(&capsule),
        owner: capsule.owner,
        grantee,
        blob_id: capsule.blob_id,
        count,
        expires_ms,
    });
    transfer::share_object(capsule);
}

/// The owner takes it back. Already-decrypted text isn't kept by the grantee, so this ends access.
public fun revoke(capsule: &mut Capsule, ctx: &TxContext) {
    assert!(ctx.sender() == capsule.owner, ENotOwner);
    capsule.revoked = true;
    event::emit(CapsuleRevoked { capsule: object::id(capsule), owner: capsule.owner });
}

/// Seal's check, dry-run by the key servers: the grantee, before expiry, not revoked, this key id.
entry fun seal_approve(id: vector<u8>, capsule: &Capsule, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == capsule.grantee, ENoAccess);
    assert!(!capsule.revoked, ENoAccess);
    assert!(clock.timestamp_ms() < capsule.expires_ms, ENoAccess);
    assert!(id == capsule.key_id, ENoAccess);
}

// === Reads ===

public fun owner(c: &Capsule): address { c.owner }

public fun grantee(c: &Capsule): address { c.grantee }

public fun blob_id(c: &Capsule): &String { &c.blob_id }

public fun count(c: &Capsule): u64 { c.count }

public fun expires_ms(c: &Capsule): u64 { c.expires_ms }

public fun revoked(c: &Capsule): bool { c.revoked }

#[test_only]
public fun approve_for_testing(id: vector<u8>, capsule: &Capsule, clock: &Clock, ctx: &TxContext) {
    seal_approve(id, capsule, clock, ctx)
}
