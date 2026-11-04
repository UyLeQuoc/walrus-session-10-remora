#[test_only]
module remora_capsule::capsule_tests;

use remora_capsule::capsule::{Self, Capsule};
use std::unit_test::destroy;
use sui::clock;
use sui::test_scenario as ts;

const OWNER: address = @0xA;
const GRANTEE: address = @0xB;
const STRANGER: address = @0xC;
const DAY: u64 = 24 * 60 * 60 * 1000;

fun key(): vector<u8> {
    let mut k = vector[];
    let mut i = 0u8;
    while (i < 32) {
        k.push_back(i);
        i = i + 1;
    };
    k
}

fun lend(s: &mut ts::Scenario, clock: &clock::Clock, days: u64) {
    s.next_tx(OWNER);
    capsule::create(GRANTEE, key(), b"blob-1".to_string(), 3, clock.timestamp_ms() + days * DAY, clock, s.ctx());
}

#[test]
fun grantee_decrypts_until_revoked() {
    let mut s = ts::begin(OWNER);
    let mut clock = clock::create_for_testing(s.ctx());
    clock.set_for_testing(1_000);
    lend(&mut s, &clock, 7);
    s.next_tx(GRANTEE);
    let c = s.take_shared<Capsule>();
    capsule::approve_for_testing(key(), &c, &clock, s.ctx());
    assert!(c.count() == 3 && c.grantee() == GRANTEE && !c.revoked());
    ts::return_shared(c);
    s.next_tx(OWNER);
    let mut c = s.take_shared<Capsule>();
    capsule::revoke(&mut c, s.ctx());
    assert!(c.revoked());
    ts::return_shared(c);
    destroy(clock);
    s.end();
}

#[test, expected_failure(abort_code = capsule::ENoAccess)]
fun a_stranger_cant_decrypt() {
    let mut s = ts::begin(OWNER);
    let clock = clock::create_for_testing(s.ctx());
    lend(&mut s, &clock, 7);
    s.next_tx(STRANGER);
    let c = s.take_shared<Capsule>();
    capsule::approve_for_testing(key(), &c, &clock, s.ctx());
    abort 99
}

#[test, expected_failure(abort_code = capsule::ENoAccess)]
fun revoked_means_no_key() {
    let mut s = ts::begin(OWNER);
    let clock = clock::create_for_testing(s.ctx());
    lend(&mut s, &clock, 7);
    s.next_tx(OWNER);
    let mut c = s.take_shared<Capsule>();
    capsule::revoke(&mut c, s.ctx());
    ts::return_shared(c);
    s.next_tx(GRANTEE);
    let c = s.take_shared<Capsule>();
    capsule::approve_for_testing(key(), &c, &clock, s.ctx());
    abort 99
}

#[test, expected_failure(abort_code = capsule::ENoAccess)]
fun expired_means_no_key() {
    let mut s = ts::begin(OWNER);
    let mut clock = clock::create_for_testing(s.ctx());
    lend(&mut s, &clock, 1);
    clock.increment_for_testing(DAY + 1);
    s.next_tx(GRANTEE);
    let c = s.take_shared<Capsule>();
    capsule::approve_for_testing(key(), &c, &clock, s.ctx());
    abort 99
}

#[test, expected_failure(abort_code = capsule::ENoAccess)]
fun another_key_id_is_refused() {
    let mut s = ts::begin(OWNER);
    let clock = clock::create_for_testing(s.ctx());
    lend(&mut s, &clock, 7);
    s.next_tx(GRANTEE);
    let c = s.take_shared<Capsule>();
    capsule::approve_for_testing(b"another key", &c, &clock, s.ctx());
    abort 99
}

#[test, expected_failure(abort_code = capsule::ENotOwner)]
fun only_the_owner_revokes() {
    let mut s = ts::begin(OWNER);
    let clock = clock::create_for_testing(s.ctx());
    lend(&mut s, &clock, 7);
    s.next_tx(GRANTEE);
    let mut c = s.take_shared<Capsule>();
    capsule::revoke(&mut c, s.ctx());
    abort 99
}

#[test, expected_failure(abort_code = capsule::EBadExpiry)]
fun at_most_thirty_days() {
    let mut s = ts::begin(OWNER);
    let clock = clock::create_for_testing(s.ctx());
    lend(&mut s, &clock, 31);
    abort 99
}
