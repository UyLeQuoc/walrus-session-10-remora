#[test_only]
module remora::disc_tests;

use remora::disc::{Self, DISC, Disc, Paid, Registry};
use std::string::String;
use sui::allowance::{Self, Allowance, AllowanceCap, RateLimit};
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::event;
use sui::test_scenario::{Self as ts, Scenario};

public struct TEST has store {}

const FUNDER: address = @0xF;
const SPENDER: address = @0x5;
const NEW_SPENDER: address = @0x55;
const PAYEE: address = @0xA;
const PAYEE2: address = @0xA2;
const STRANGER: address = @0xB;

const FUNDS: u64 = 10_000;
const LIFETIME_CAP: u256 = 1_000;
const PER_PAYMENT: u64 = 400;
const INTENT: vector<u8> = x"8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4";

// === Harness ===

/// Funder has settled funds; a Disc "disc-1" (lifetime cap 1000, per payment 400, payee PAYEE) is
/// live during [start, expiry).
fun setup(start_ms: u64, expiry_ms: u64): (Scenario, Clock) {
    let mut scenario = ts::begin(FUNDER);
    disc::init_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    balance::create_for_testing<TEST>(FUNDS).send_funds(FUNDER);
    scenario.next_tx(FUNDER);
    issue(&mut scenario, b"disc-1".to_string(), start_ms, expiry_ms, option::none(), PER_PAYMENT);
    (scenario, clock)
}

fun live(): (Scenario, Clock) { setup(0, 1_000_000) }

fun issue(
    scenario: &mut Scenario,
    name: String,
    start_ms: u64,
    expiry_ms: u64,
    rate_limit: Option<RateLimit>,
    per_payment: u64,
): ID {
    let mut registry = scenario.take_shared<Registry>();
    let proposal = allowance::propose_for_app<Balance<TEST>, DISC>(
        name,
        SPENDER,
        option::some(LIFETIME_CAP),
        option::some(start_ms),
        option::some(expiry_ms),
        rate_limit,
        scenario.ctx(),
    );
    let id = disc::issue<TEST>(&mut registry, proposal, vector[PAYEE], per_payment, scenario.ctx());
    ts::return_shared(registry);
    id
}

/// `sender` pays `amount` to `payee` through the most recent Disc and allowance, in a new tx.
fun pay_as(scenario: &mut Scenario, clock: &Clock, sender: address, payee: address, amount: u256) {
    scenario.next_tx(sender);
    let disc = scenario.take_shared<Disc>();
    let mut alw = scenario.take_shared<Allowance<Balance<TEST>>>();
    let w = allowance::new_withdrawal_for_testing<Balance<TEST>>(object::id(&alw), FUNDER, amount);
    disc::pay<TEST>(&disc, &mut alw, w, payee, INTENT, clock, scenario.ctx());
    ts::return_shared(alw);
    ts::return_shared(disc);
}

fun pay(scenario: &mut Scenario, clock: &Clock, payee: address, amount: u256) {
    pay_as(scenario, clock, SPENDER, payee, amount);
}

/// Runs `$f(&mut disc)` as `sender` in a new tx.
macro fun with_disc($scenario: &mut Scenario, $sender: address, $f: |&mut Disc, &mut TxContext|) {
    let scenario = $scenario;
    scenario.next_tx($sender);
    let mut disc = scenario.take_shared<Disc>();
    $f(&mut disc, scenario.ctx());
    ts::return_shared(disc);
}

fun settled(scenario: &mut Scenario, who: address): u64 {
    scenario.next_tx(FUNDER);
    ts::settled_balance<TEST>(who)
}

fun finish(scenario: Scenario, clock: Clock) {
    clock.destroy_for_testing();
    scenario.end();
}

// === Paths ===

#[test]
fun pays_within_caps_and_emits_paid() {
    let (mut scenario, clock) = live();
    scenario.next_tx(SPENDER);
    let disc = scenario.take_shared<Disc>();
    let mut alw = scenario.take_shared<Allowance<Balance<TEST>>>();
    let w = allowance::new_withdrawal_for_testing<Balance<TEST>>(object::id(&alw), FUNDER, 400);
    disc::pay<TEST>(&disc, &mut alw, w, PAYEE, INTENT, &clock, scenario.ctx());
    let events = event::events_by_type<Paid>();
    assert!(events.length() == 1);
    assert!(events[0] == disc::new_paid_for_testing(object::id(&disc), PAYEE, 400, INTENT, 0));
    ts::return_shared(alw);
    ts::return_shared(disc);

    pay(&mut scenario, &clock, PAYEE, 400);
    pay(&mut scenario, &clock, PAYEE, 200);
    assert!(settled(&mut scenario, PAYEE) == 1_000);
    assert!(settled(&mut scenario, FUNDER) == FUNDS - 1_000);
    finish(scenario, clock);
}

#[test]
fun registry_finds_live_discs_only() {
    let (mut scenario, clock) = live();
    scenario.next_tx(FUNDER);
    let registry = scenario.take_shared<Registry>();
    let disc = scenario.take_shared<Disc>();
    assert!(registry.disc_id(FUNDER, b"disc-1".to_string()) == option::some(object::id(&disc)));
    assert!(registry.disc_id(FUNDER, b"other".to_string()).is_none());
    assert!(registry.disc_id(STRANGER, b"disc-1".to_string()).is_none());
    assert!(disc.owner() == FUNDER && disc.per_payment_cap() == PER_PAYMENT && !disc.is_paused());
    ts::return_shared(disc);
    ts::return_shared(registry);
    finish(scenario, clock);
}

#[test]
fun pause_blocks_and_unpause_resumes() {
    let (mut scenario, clock) = live();
    with_disc!(&mut scenario, FUNDER, |d, ctx| d.pause(true, ctx));
    with_disc!(&mut scenario, FUNDER, |d, ctx| d.pause(false, ctx));
    pay(&mut scenario, &clock, PAYEE, 1);
    finish(scenario, clock);
}

#[test]
fun set_payees_swaps_the_allowlist() {
    let (mut scenario, clock) = live();
    with_disc!(&mut scenario, FUNDER, |d, ctx| d.set_payees(vector[PAYEE2], ctx));
    pay(&mut scenario, &clock, PAYEE2, 100);
    assert!(settled(&mut scenario, PAYEE2) == 100);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = disc::EPayeeNotAllowed)]
fun set_payees_removes_old_payee() {
    let (mut scenario, clock) = live();
    with_disc!(&mut scenario, FUNDER, |d, ctx| d.set_payees(vector[PAYEE2], ctx));
    pay(&mut scenario, &clock, PAYEE, 1);
    finish(scenario, clock);
}

#[test]
fun set_per_payment_cap_raises_the_cap() {
    let (mut scenario, clock) = live();
    with_disc!(&mut scenario, FUNDER, |d, ctx| d.set_per_payment_cap(900, ctx));
    pay(&mut scenario, &clock, PAYEE, 900);
    finish(scenario, clock);
}

#[test]
fun rotate_moves_spending_to_the_new_key() {
    let (mut scenario, clock) = live();
    scenario.next_tx(FUNDER);
    let disc = scenario.take_shared<Disc>();
    let mut alw = scenario.take_shared<Allowance<Balance<TEST>>>();
    disc.rotate(&mut alw, NEW_SPENDER, scenario.ctx());
    ts::return_shared(alw);
    ts::return_shared(disc);
    pay_as(&mut scenario, &clock, NEW_SPENDER, PAYEE, 400);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = sui::allowance::ENotSpender)]
fun rotate_locks_out_the_old_key() {
    let (mut scenario, clock) = live();
    scenario.next_tx(FUNDER);
    let disc = scenario.take_shared<Disc>();
    let mut alw = scenario.take_shared<Allowance<Balance<TEST>>>();
    disc.rotate(&mut alw, NEW_SPENDER, scenario.ctx());
    ts::return_shared(alw);
    ts::return_shared(disc);
    pay(&mut scenario, &clock, PAYEE, 1);
    finish(scenario, clock);
}

/// Budget change (B7): revoke + reissue under the same name, in one owner transaction.
#[test]
fun revoke_and_reissue_in_one_ptb() {
    let (mut scenario, clock) = live();
    scenario.next_tx(FUNDER);
    let old_disc = scenario.take_shared<Disc>();
    let old_id = object::id(&old_disc);
    let mut registry = scenario.take_shared<Registry>();
    let cap = scenario.take_from_sender<AllowanceCap<Balance<TEST>>>();
    let alw = scenario.take_shared<Allowance<Balance<TEST>>>();
    disc::revoke<TEST>(&mut registry, old_disc, cap, alw, scenario.ctx());
    let proposal = allowance::propose_for_app<Balance<TEST>, DISC>(
        b"disc-1".to_string(),
        SPENDER,
        option::some(5_000),
        option::none(),
        option::some(1_000_000),
        option::none(),
        scenario.ctx(),
    );
    let new_id = disc::issue<TEST>(&mut registry, proposal, vector[PAYEE], 2_000, scenario.ctx());
    assert!(new_id != old_id);
    assert!(registry.disc_id(FUNDER, b"disc-1".to_string()) == option::some(new_id));
    ts::return_shared(registry);

    // The new budget applies: 2000 in one payment was over both old caps.
    pay(&mut scenario, &clock, PAYEE, 2_000);
    finish(scenario, clock);
}

#[test]
fun migrate_brings_an_old_disc_forward() {
    let (mut scenario, clock) = live();
    with_disc!(&mut scenario, FUNDER, |d, _ctx| d.set_version_for_testing(0));
    with_disc!(&mut scenario, STRANGER, |d, _ctx| d.migrate_disc());
    pay(&mut scenario, &clock, PAYEE, 1);
    finish(scenario, clock);
}

// === Negative cases ===

#[test, expected_failure(abort_code = disc::EPayeeNotAllowed)]
fun rejects_payee_not_on_allowlist() {
    let (mut scenario, clock) = live();
    pay(&mut scenario, &clock, STRANGER, 1);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = disc::EOverPaymentCap)]
fun rejects_payment_over_per_payment_cap() {
    let (mut scenario, clock) = live();
    pay(&mut scenario, &clock, PAYEE, 401);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = disc::EPaused)]
fun rejects_payment_while_paused() {
    let (mut scenario, clock) = live();
    with_disc!(&mut scenario, FUNDER, |d, ctx| d.pause(true, ctx));
    pay(&mut scenario, &clock, PAYEE, 1);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = disc::EBadIntent)]
fun rejects_intent_that_isnt_32_bytes() {
    let (mut scenario, clock) = live();
    scenario.next_tx(SPENDER);
    let disc = scenario.take_shared<Disc>();
    let mut alw = scenario.take_shared<Allowance<Balance<TEST>>>();
    let w = allowance::new_withdrawal_for_testing<Balance<TEST>>(object::id(&alw), FUNDER, 1);
    disc::pay<TEST>(&disc, &mut alw, w, PAYEE, b"short", &clock, scenario.ctx());
    abort
}

#[test, expected_failure(abort_code = disc::EWrongDisc)]
fun rejects_allowance_of_another_disc() {
    let (mut scenario, clock) = live();
    scenario.next_tx(FUNDER);
    let disc1 = ts::most_recent_id_shared<Disc>().destroy_some();
    issue(&mut scenario, b"disc-2".to_string(), 0, 1_000_000, option::none(), 1_000);
    scenario.next_tx(SPENDER);
    let alw2_id = ts::most_recent_id_shared<Allowance<Balance<TEST>>>().destroy_some();
    // Disc 1's policy with disc 2's allowance.
    let disc = scenario.take_shared_by_id<Disc>(disc1);
    let mut alw = scenario.take_shared_by_id<Allowance<Balance<TEST>>>(alw2_id);
    let w = allowance::new_withdrawal_for_testing<Balance<TEST>>(alw2_id, FUNDER, 1);
    disc::pay<TEST>(&disc, &mut alw, w, PAYEE, INTENT, &clock, scenario.ctx());
    abort
}

#[test, expected_failure(abort_code = sui::allowance::EExceedsLifetimeCap)]
fun rejects_payment_over_lifetime_cap() {
    let (mut scenario, clock) = live();
    pay(&mut scenario, &clock, PAYEE, 400);
    pay(&mut scenario, &clock, PAYEE, 400);
    pay(&mut scenario, &clock, PAYEE, 201);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = sui::allowance::EExceedsRateLimit)]
fun rejects_payment_over_rate_window() {
    let mut scenario = ts::begin(FUNDER);
    disc::init_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    balance::create_for_testing<TEST>(FUNDS).send_funds(FUNDER);
    scenario.next_tx(FUNDER);
    let rate = allowance::periodic_rate_limit(3_600_000, 500);
    issue(&mut scenario, b"rated".to_string(), 0, 1_000_000, option::some(rate), PER_PAYMENT);
    pay(&mut scenario, &clock, PAYEE, 300);
    pay(&mut scenario, &clock, PAYEE, 201);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = sui::allowance::ENotStarted)]
fun rejects_payment_before_start() {
    let (mut scenario, clock) = setup(1_000, 1_000_000);
    pay(&mut scenario, &clock, PAYEE, 1);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = sui::allowance::EExpired)]
fun rejects_payment_after_expiry() {
    let (mut scenario, mut clock) = setup(0, 1_000);
    clock.set_for_testing(1_000);
    pay(&mut scenario, &clock, PAYEE, 1);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = sui::allowance::ENotSpender)]
fun rejects_payment_from_non_spender() {
    let (mut scenario, clock) = live();
    pay_as(&mut scenario, &clock, STRANGER, PAYEE, 1);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = disc::EDiscExists)]
fun rejects_duplicate_key() {
    let (mut scenario, clock) = live();
    scenario.next_tx(FUNDER);
    issue(&mut scenario, b"disc-1".to_string(), 0, 1_000_000, option::none(), PER_PAYMENT);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = disc::EZeroCap)]
fun rejects_zero_per_payment_cap() {
    let mut scenario = ts::begin(FUNDER);
    disc::init_for_testing(scenario.ctx());
    scenario.next_tx(FUNDER);
    issue(&mut scenario, b"zero".to_string(), 0, 1_000_000, option::none(), 0);
    scenario.end();
}

#[test, expected_failure(abort_code = disc::EWrongVersion)]
fun rejects_payment_through_an_old_version() {
    let (mut scenario, clock) = live();
    with_disc!(&mut scenario, FUNDER, |d, _ctx| d.set_version_for_testing(0));
    pay(&mut scenario, &clock, PAYEE, 1);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = disc::ENotUpgrade)]
fun rejects_migrating_a_current_disc() {
    let (mut scenario, clock) = live();
    with_disc!(&mut scenario, STRANGER, |d, _ctx| d.migrate_disc());
    finish(scenario, clock);
}

// --- Only the owner reconfigures ---

#[test, expected_failure(abort_code = disc::ENotOwner)]
fun non_owner_cannot_pause() {
    let (mut scenario, clock) = live();
    with_disc!(&mut scenario, SPENDER, |d, ctx| d.pause(true, ctx));
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = disc::ENotOwner)]
fun non_owner_cannot_set_payees() {
    let (mut scenario, clock) = live();
    with_disc!(&mut scenario, SPENDER, |d, ctx| d.set_payees(vector[SPENDER], ctx));
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = disc::ENotOwner)]
fun non_owner_cannot_raise_the_cap() {
    let (mut scenario, clock) = live();
    with_disc!(&mut scenario, SPENDER, |d, ctx| d.set_per_payment_cap(1_000_000, ctx));
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = disc::ENotOwner)]
fun non_owner_cannot_rotate() {
    let (mut scenario, _clock) = live();
    scenario.next_tx(SPENDER);
    let disc = scenario.take_shared<Disc>();
    let mut alw = scenario.take_shared<Allowance<Balance<TEST>>>();
    disc.rotate(&mut alw, STRANGER, scenario.ctx());
    abort
}

#[test, expected_failure(abort_code = disc::ENotOwner)]
fun non_owner_cannot_revoke() {
    let (mut scenario, _clock) = live();
    // The cap is soulbound to the funder, so take it as the funder and replay as someone else.
    scenario.next_tx(FUNDER);
    let cap = scenario.take_from_sender<AllowanceCap<Balance<TEST>>>();
    scenario.next_tx(STRANGER);
    let mut registry = scenario.take_shared<Registry>();
    let disc = scenario.take_shared<Disc>();
    let alw = scenario.take_shared<Allowance<Balance<TEST>>>();
    disc::revoke<TEST>(&mut registry, disc, cap, alw, scenario.ctx());
    abort
}

// === Invariants ===

/// Over a mixed sequence, money only ever reaches allowlisted payees, never above the per-payment
/// cap, and the funder loses exactly what the payees gain.
#[test]
fun money_only_reaches_allowlisted_payees_within_caps() {
    let (mut scenario, clock) = live();
    with_disc!(&mut scenario, FUNDER, |d, ctx| d.set_payees(vector[PAYEE, PAYEE2], ctx));
    let amounts = vector[1, 50, 400, 120, 99, 230];
    let mut paid = 0;
    amounts.length().do!(|i| {
        let payee = if (i % 2 == 0) PAYEE else PAYEE2;
        pay(&mut scenario, &clock, payee, amounts[i] as u256);
        paid = paid + amounts[i];
    });
    let to_payees = settled(&mut scenario, PAYEE) + settled(&mut scenario, PAYEE2);
    assert!(to_payees == paid);
    assert!(settled(&mut scenario, FUNDER) == FUNDS - paid);
    assert!(settled(&mut scenario, STRANGER) == 0);
    assert!(settled(&mut scenario, SPENDER) == 0);
    finish(scenario, clock);
}

/// The spender's own actions never change the Disc's policy.
#[test]
fun spending_leaves_the_policy_untouched() {
    let (mut scenario, clock) = live();
    pay(&mut scenario, &clock, PAYEE, 400);
    scenario.next_tx(FUNDER);
    let disc = scenario.take_shared<Disc>();
    assert!(disc.payees() == &vector[PAYEE]);
    assert!(disc.per_payment_cap() == PER_PAYMENT);
    assert!(!disc.is_paused());
    assert!(disc.version() == 1);
    ts::return_shared(disc);
    finish(scenario, clock);
}
