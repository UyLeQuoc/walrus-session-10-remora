#[test_only]
module remora_anchor::anchor_tests;

use remora_anchor::anchor::{Self, Anchored};
use std::unit_test::destroy;
use sui::clock;
use sui::event;
use sui::test_scenario as ts;

const REMORA: address = @0xA;

fun root(len: u64): vector<u8> {
    let mut r = vector[];
    let mut i = 0;
    while (i < len) {
        r.push_back((i as u8));
        i = i + 1;
    };
    r
}

#[test]
fun anchors_a_root_and_names_the_sender() {
    let mut s = ts::begin(REMORA);
    let mut clock = clock::create_for_testing(s.ctx());
    clock.set_for_testing(5_000);
    anchor::anchor(root(32), 12, 1_000, 4_000, &clock, s.ctx());
    let events = event::events_by_type<Anchored>();
    assert!(events.length() == 1);
    assert!(events[0] == anchor::anchored_for_testing(REMORA, root(32), 12, 1_000, 4_000, 5_000));
    destroy(clock);
    s.end();
}

#[test]
fun one_wake_in_one_instant_is_a_batch() {
    let mut s = ts::begin(REMORA);
    let clock = clock::create_for_testing(s.ctx());
    anchor::anchor(root(32), 1, 7, 7, &clock, s.ctx());
    assert!(event::events_by_type<Anchored>().length() == 1);
    destroy(clock);
    s.end();
}

#[test, expected_failure(abort_code = anchor::EBadRoot)]
fun a_short_root_is_refused() {
    let mut s = ts::begin(REMORA);
    let clock = clock::create_for_testing(s.ctx());
    anchor::anchor(root(31), 1, 0, 0, &clock, s.ctx());
    abort 99
}

#[test, expected_failure(abort_code = anchor::EBadRoot)]
fun a_long_root_is_refused() {
    let mut s = ts::begin(REMORA);
    let clock = clock::create_for_testing(s.ctx());
    anchor::anchor(root(33), 1, 0, 0, &clock, s.ctx());
    abort 99
}

#[test, expected_failure(abort_code = anchor::EEmpty)]
fun an_empty_batch_is_refused() {
    let mut s = ts::begin(REMORA);
    let clock = clock::create_for_testing(s.ctx());
    anchor::anchor(root(32), 0, 0, 0, &clock, s.ctx());
    abort 99
}

#[test, expected_failure(abort_code = anchor::EBadRange)]
fun a_backwards_range_is_refused() {
    let mut s = ts::begin(REMORA);
    let clock = clock::create_for_testing(s.ctx());
    anchor::anchor(root(32), 3, 2_000, 1_000, &clock, s.ctx());
    abort 99
}
