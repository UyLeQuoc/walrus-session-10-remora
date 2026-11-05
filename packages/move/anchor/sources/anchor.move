/// U19 B2 (ADR-0139): Merkle anchors for the Wakes that didn't pay. A paid Wake is already onchain
/// as `Paid.intent`; the rest (answers without a purchase, config changes, memory writes) are hashed
/// into a sorted-pair sha256 Merkle tree off chain, and a remora's key anchors the root here. The
/// event is the record: nothing is stored, and anyone can check a Wake's inclusion proof against it.
module remora_anchor::anchor;

use sui::clock::Clock;
use sui::event;

const EBadRoot: u64 = 1;
const EEmpty: u64 = 2;
const EBadRange: u64 = 3;

public struct Anchored has copy, drop {
    /// Who anchored: the remora's own key, the same address that signs its Wakes.
    anchorer: address,
    /// The sha256 Merkle root, 32 bytes.
    root: vector<u8>,
    /// How many leaves (Wakes) the tree holds.
    count: u64,
    /// The first and last leaf's time, in ms.
    from_ms: u64,
    to_ms: u64,
    /// When it was anchored, from the clock.
    at_ms: u64,
}

/// Anchors one batch's root. Anyone can call it; the event names the sender, so a reader trusts
/// only anchors whose `anchorer` is the remora that made the Wakes.
public fun anchor(
    root: vector<u8>,
    count: u64,
    from_ms: u64,
    to_ms: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(root.length() == 32, EBadRoot);
    assert!(count > 0, EEmpty);
    assert!(from_ms <= to_ms, EBadRange);
    event::emit(Anchored {
        anchorer: ctx.sender(),
        root,
        count,
        from_ms,
        to_ms,
        at_ms: clock.timestamp_ms(),
    });
}

#[test_only]
public fun anchored_for_testing(
    anchorer: address,
    root: vector<u8>,
    count: u64,
    from_ms: u64,
    to_ms: u64,
    at_ms: u64,
): Anchored {
    Anchored { anchorer, root, count, from_ms, to_ms, at_ms }
}
