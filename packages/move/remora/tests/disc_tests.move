#[test_only]
module remora::disc_tests;

use remora::disc::{Self, DISC, Registry};
use sui::allowance::{Self, Allowance, AllowanceCap};
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::test_scenario::{Self as ts, Scenario};

public struct TEST has store {}

const FUNDER: address = @0xF;
const SPENDER: address = @0x5;
const PAYEE: address = @0xA;
const STRANGER: address = @0xB;

const LIFETIME_CAP: u256 = 1_000;
const PER_PAYMENT: u64 = 400;

/// Funder issues a DISC-bound allowance (lifetime cap 1000, per payment 400, payee PAYEE) that
/// is live during [start, expiry).
fun setup(start_ms: u64, expiry_ms: u64): (Scenario, Clock) {
    let mut scenario = ts::begin(FUNDER);
    disc::init_for_testing(scenario.ctx());
    let clock = clock::create_for_testing(scenario.ctx());
    // Settled funds in the funder's address balance, which the spends draw down.
    balance::create_for_testing<TEST>(10_000).send_funds(FUNDER);
    scenario.next_tx(FUNDER);
    issue(&mut scenario, b"disc-1", start_ms, expiry_ms);
    (scenario, clock)
}

fun issue(scenario: &mut Scenario, name: vector<u8>, start_ms: u64, expiry_ms: u64) {
    let mut registry = scenario.take_shared<Registry>();
    let proposal = allowance::propose_for_app<Balance<TEST>, DISC>(
        name.to_string(),
        SPENDER,
        option::some(LIFETIME_CAP),
        option::some(start_ms),
        option::some(expiry_ms),
        option::none(),
        scenario.ctx(),
    );
    disc::issue<TEST>(&mut registry, proposal, vector[PAYEE], PER_PAYMENT, scenario.ctx());
    ts::return_shared(registry);
}

/// Spender pays `amount` to `payee` in a new transaction.
fun pay(scenario: &mut Scenario, clock: &Clock, payee: address, amount: u256) {
    scenario.next_tx(SPENDER);
    let registry = scenario.take_shared<Registry>();
    let mut alw = scenario.take_shared<Allowance<Balance<TEST>>>();
    let w = allowance::new_withdrawal_for_testing<Balance<TEST>>(object::id(&alw), FUNDER, amount);
    disc::pay<TEST>(&registry, &mut alw, w, payee, clock, scenario.ctx());
    ts::return_shared(alw);
    ts::return_shared(registry);
}

fun finish(scenario: Scenario, clock: Clock) {
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun pays_allowlisted_payee_within_caps() {
    let (mut scenario, clock) = setup(0, 1_000_000);
    pay(&mut scenario, &clock, PAYEE, 400);
    pay(&mut scenario, &clock, PAYEE, 400);
    pay(&mut scenario, &clock, PAYEE, 200);
    scenario.next_tx(FUNDER);
    assert!(ts::settled_balance<TEST>(PAYEE) == 1_000);
    assert!(ts::settled_balance<TEST>(FUNDER) == 9_000);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = disc::EPayeeNotAllowed)]
fun rejects_payee_not_on_allowlist() {
    let (mut scenario, clock) = setup(0, 1_000_000);
    pay(&mut scenario, &clock, STRANGER, 1);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = disc::EOverPaymentCap)]
fun rejects_payment_over_per_payment_cap() {
    let (mut scenario, clock) = setup(0, 1_000_000);
    pay(&mut scenario, &clock, PAYEE, 401);
    finish(scenario, clock);
}

#[test, expected_failure(abort_code = sui::allowance::EExceedsLifetimeCap)]
fun rejects_payment_over_lifetime_cap() {
    let (mut scenario, clock) = setup(0, 1_000_000);
    pay(&mut scenario, &clock, PAYEE, 400);
    pay(&mut scenario, &clock, PAYEE, 400);
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
    let (mut scenario, clock) = setup(0, 1_000_000);
    scenario.next_tx(STRANGER);
    let registry = scenario.take_shared<Registry>();
    let mut alw = scenario.take_shared<Allowance<Balance<TEST>>>();
    let w = allowance::new_withdrawal_for_testing<Balance<TEST>>(object::id(&alw), FUNDER, 1);
    disc::pay<TEST>(&registry, &mut alw, w, PAYEE, &clock, scenario.ctx());
    abort
}

#[test, expected_failure(abort_code = disc::EPolicyExists)]
fun rejects_duplicate_policy_key() {
    let (mut scenario, clock) = setup(0, 1_000_000);
    scenario.next_tx(FUNDER);
    issue(&mut scenario, b"disc-1", 0, 1_000_000);
    finish(scenario, clock);
}

#[test]
fun revoke_frees_the_policy_key() {
    let (mut scenario, clock) = setup(0, 1_000_000);
    scenario.next_tx(FUNDER);
    let mut registry = scenario.take_shared<Registry>();
    let cap = scenario.take_from_sender<AllowanceCap<Balance<TEST>>>();
    let alw = scenario.take_shared<Allowance<Balance<TEST>>>();
    disc::revoke<TEST>(&mut registry, cap, alw, scenario.ctx());
    ts::return_shared(registry);

    scenario.next_tx(FUNDER);
    issue(&mut scenario, b"disc-1", 0, 1_000_000);
    finish(scenario, clock);
}
