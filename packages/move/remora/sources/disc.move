/// The Disc (E1): onchain spending limits on a native app-bound allowance (ADR-0003, ADR-0020).
///
/// Sui enforces the budget, rate window, start and expiry, spender identity and revocation. The Disc
/// adds the payee allowlist, the per-payment cap, pause, rotation without reissuing, and `Paid` events
/// that anchor each payment to its Wake (`intent` = sha256 of the Wake's intent).
///
/// `allowance::issue` doesn't return the new allowance's ID, so a Disc is linked to its allowance by
/// the allowance's `(funder, name)`. `issue` refuses a key that's already taken, and every DISC-bound
/// allowance has to come through `issue`, so each live allowance has exactly one Disc.
///
/// Permit guards (I6): `internal::permit<DISC>()` is minted only in `issue` (the proposal's funder is
/// the sender), `pay` (the native module checks the spender, the Disc checks its policy) and `rotate`
/// (owner only).
module remora::disc;

use std::internal;
use std::string::String;
use sui::allowance::{Self, Allowance, AllowanceCap, AllowanceProposal, AllowanceWithdrawal};
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::event;
use sui::table::{Self, Table};
use sui::vec_set::{Self, VecSet};

/// Bumped on every upgrade that changes object semantics; objects migrate forward with `migrate_*`.
const VERSION: u64 = 1;
/// `Paid.intent` is a sha256 digest.
const INTENT_LENGTH: u64 = 32;

#[error(code = 1)]
const EDiscExists: vector<u8> = "A Disc with this owner and name already exists";
#[error(code = 2)]
const EWrongDisc: vector<u8> = "The allowance doesn't belong to this Disc";
#[error(code = 3)]
const EPayeeNotAllowed: vector<u8> = "Payee is not on the allowlist";
#[error(code = 4)]
const EOverPaymentCap: vector<u8> = "Payment exceeds the per-payment cap";
#[error(code = 5)]
const ENotOwner: vector<u8> = "Only the Disc's owner can do this";
#[error(code = 6)]
const EPaused: vector<u8> = "The Disc is paused";
#[error(code = 7)]
const EBadIntent: vector<u8> = "Intent must be a 32-byte sha256 digest";
#[error(code = 8)]
const EWrongVersion: vector<u8> = "Object version doesn't match the package; migrate it";
#[error(code = 9)]
const EZeroCap: vector<u8> = "Per-payment cap must be greater than zero";
#[error(code = 10)]
const ENotUpgrade: vector<u8> = "Object is already at the current version";

/// The app type allowances are bound to. Its name makes it this module's one-time witness too.
public struct DISC has drop {}

public struct DiscKey has copy, drop, store {
    owner: address,
    name: String,
}

/// Shared. Maps each live Disc's key to its ID.
public struct Registry has key {
    id: UID,
    discs: Table<DiscKey, ID>,
    version: u64,
}

/// Shared. One per DISC-bound allowance.
public struct Disc has key {
    id: UID,
    owner: address,
    name: String,
    payees: VecSet<address>,
    per_payment_cap: u64,
    paused: bool,
    version: u64,
}

// === Events (the indexer reads them from checkpoints; the allowance module emits none) ===

public struct DiscIssued has copy, drop {
    disc: ID,
    owner: address,
    name: String,
    spender: address,
    payees: vector<address>,
    per_payment_cap: u64,
}

public struct Paid has copy, drop {
    disc: ID,
    payee: address,
    amount: u64,
    intent: vector<u8>,
    ts_ms: u64,
}

public struct DiscUpdated has copy, drop {
    disc: ID,
    payees: vector<address>,
    per_payment_cap: u64,
    paused: bool,
}

public struct SpenderRotated has copy, drop {
    disc: ID,
    new_spender: address,
}

public struct DiscRevoked has copy, drop {
    disc: ID,
}

fun init(_otw: DISC, ctx: &mut TxContext) {
    transfer::share_object(Registry { id: object::new(ctx), discs: table::new(ctx), version: VERSION });
}

// === Owner ===

/// Owner, in the same PTB as `allowance::propose_for_app<Balance<C>, DISC>`. Creates and shares the
/// Disc, then issues the allowance.
public fun issue<C>(
    registry: &mut Registry,
    proposal: AllowanceProposal<Balance<C>>,
    payees: vector<address>,
    per_payment_cap: u64,
    ctx: &mut TxContext,
): ID {
    assert!(registry.version == VERSION, EWrongVersion);
    assert!(per_payment_cap > 0, EZeroCap);
    let settings = proposal.settings();
    let owner = settings.funder();
    // Defense in depth: `propose_for_app` already makes the sender the funder.
    assert!(owner == ctx.sender(), ENotOwner);
    let key = DiscKey { owner, name: *settings.name() };
    assert!(!registry.discs.contains(key), EDiscExists);
    let spender = settings.spender().destroy_some();

    let disc = Disc {
        id: object::new(ctx),
        owner,
        name: key.name,
        payees: vec_set::from_keys(payees),
        per_payment_cap,
        paused: false,
        version: VERSION,
    };
    let disc_id = object::id(&disc);
    registry.discs.add(key, disc_id);
    event::emit(DiscIssued {
        disc: disc_id,
        owner,
        name: key.name,
        spender,
        payees: *disc.payees.keys(),
        per_payment_cap,
    });
    transfer::share_object(disc);
    allowance::issue(proposal, allowance::settings_permit(internal::permit<DISC>()), ctx);
    disc_id
}

/// Owner: new spender key (B9), budget intact.
public fun rotate<C>(
    disc: &Disc,
    allowance: &mut Allowance<Balance<C>>,
    new_spender: address,
    ctx: &mut TxContext,
) {
    disc.assert_owner(ctx);
    disc.assert_matches(allowance);
    allowance::rotate_spender(
        allowance,
        allowance::settings_permit(internal::permit<DISC>()),
        new_spender,
    );
    event::emit(SpenderRotated { disc: object::id(disc), new_spender });
}

public fun set_payees(disc: &mut Disc, payees: vector<address>, ctx: &mut TxContext) {
    disc.assert_owner(ctx);
    disc.payees = vec_set::from_keys(payees);
    disc.emit_updated();
}

public fun set_per_payment_cap(disc: &mut Disc, per_payment_cap: u64, ctx: &mut TxContext) {
    disc.assert_owner(ctx);
    assert!(per_payment_cap > 0, EZeroCap);
    disc.per_payment_cap = per_payment_cap;
    disc.emit_updated();
}

/// The panic button (N10) pauses every Disc of an owner in one PTB.
public fun pause(disc: &mut Disc, paused: bool, ctx: &mut TxContext) {
    disc.assert_owner(ctx);
    disc.paused = paused;
    disc.emit_updated();
}

/// Owner: deletes the Disc and the allowance and frees the key. Budget changes are revoke + reissue
/// (same name allowed) in one owner PTB.
public fun revoke<C>(
    registry: &mut Registry,
    disc: Disc,
    cap: AllowanceCap<Balance<C>>,
    allowance: Allowance<Balance<C>>,
    ctx: &mut TxContext,
) {
    assert!(registry.version == VERSION, EWrongVersion);
    disc.assert_owner(ctx);
    disc.assert_matches(&allowance);
    let Disc { id, owner, name, .. } = disc;
    registry.discs.remove(DiscKey { owner, name });
    event::emit(DiscRevoked { disc: id.to_inner() });
    id.delete();
    allowance::revoke(cap, allowance);
}

// === Spender ===

/// Spender (the remora key; gas sponsored): pays `payee` from the owner's address balance. The amount
/// is the withdrawal's. The native module checks the spender, the window, the lifetime cap and the
/// rate limit; the Disc checks pause, payee and per-payment cap. Any abort reverts the whole PTB.
public fun pay<C>(
    disc: &Disc,
    allowance: &mut Allowance<Balance<C>>,
    withdrawal: AllowanceWithdrawal<Balance<C>>,
    payee: address,
    intent: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(disc.version == VERSION, EWrongVersion);
    assert!(!disc.paused, EPaused);
    disc.assert_matches(allowance);
    assert!(disc.payees.contains(&payee), EPayeeNotAllowed);
    assert!(intent.length() == INTENT_LENGTH, EBadIntent);

    let permit = allowance::spend_permit(internal::permit<DISC>());
    let paid = allowance::app_balance_spend(allowance, permit, withdrawal, clock, ctx);
    let amount = paid.value();
    assert!(amount <= disc.per_payment_cap, EOverPaymentCap);
    balance::send_funds(paid, payee);
    event::emit(Paid { disc: object::id(disc), payee, amount, intent, ts_ms: clock.timestamp_ms() });
}

// === Upgrades (I6) ===

/// Moves an object to this package's `VERSION`. Only ever forward, so anyone may call it.
public fun migrate_registry(registry: &mut Registry) {
    assert!(registry.version < VERSION, ENotUpgrade);
    registry.version = VERSION;
}

public fun migrate_disc(disc: &mut Disc) {
    assert!(disc.version < VERSION, ENotUpgrade);
    disc.version = VERSION;
}

// === Reads ===

public fun owner(disc: &Disc): address { disc.owner }

public fun name(disc: &Disc): &String { &disc.name }

public fun payees(disc: &Disc): &vector<address> { disc.payees.keys() }

public fun per_payment_cap(disc: &Disc): u64 { disc.per_payment_cap }

public fun is_paused(disc: &Disc): bool { disc.paused }

public fun version(disc: &Disc): u64 { disc.version }

public fun disc_id(registry: &Registry, owner: address, name: String): Option<ID> {
    let key = DiscKey { owner, name };
    if (registry.discs.contains(key)) option::some(registry.discs[key]) else option::none()
}

// === Internals ===

fun assert_owner(disc: &Disc, ctx: &TxContext) {
    assert!(disc.version == VERSION, EWrongVersion);
    assert!(ctx.sender() == disc.owner, ENotOwner);
}

fun assert_matches<C>(disc: &Disc, allowance: &Allowance<Balance<C>>) {
    let settings = allowance.settings();
    assert!(settings.funder() == disc.owner && settings.name() == &disc.name, EWrongDisc);
}

fun emit_updated(disc: &Disc) {
    event::emit(DiscUpdated {
        disc: object::id(disc),
        payees: *disc.payees.keys(),
        per_payment_cap: disc.per_payment_cap,
        paused: disc.paused,
    });
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(DISC {}, ctx);
}

#[test_only]
public fun set_version_for_testing(disc: &mut Disc, version: u64) {
    disc.version = version;
}

#[test_only]
public fun new_paid_for_testing(
    disc: ID,
    payee: address,
    amount: u64,
    intent: vector<u8>,
    ts_ms: u64,
): Paid {
    Paid { disc, payee, amount, intent, ts_ms }
}
