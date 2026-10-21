#[test_only]
module remora_hatchery::hatchery_tests;

use remora_hatchery::hatchery::{Self, Deprecated, Forked, Published, Registry, Template};
use std::string::String;
use sui::event;
use sui::test_scenario::{Self as ts, Scenario};

const AUTHOR: address = @0xA;
const HATCHER: address = @0xB;
const STRANGER: address = @0xC;

fun blob(): String { b"zdgXXpFxc9jm8oljSG7SGq0u1s16xINpIiRIZD8Vdfw".to_string() }

/// The registry is shared and AUTHOR has published one template.
fun published(): (Scenario, ID) {
    let mut scenario = ts::begin(AUTHOR);
    hatchery::init_for_testing(scenario.ctx());
    scenario.next_tx(AUTHOR);
    let registry = scenario.take_shared<Registry>();
    let id = hatchery::publish(&registry, blob(), scenario.ctx());
    ts::return_shared(registry);
    scenario.next_tx(AUTHOR);
    (scenario, id)
}

#[test]
fun publish_freezes_the_template_and_emits_published() {
    let mut scenario = ts::begin(AUTHOR);
    hatchery::init_for_testing(scenario.ctx());
    scenario.next_tx(AUTHOR);
    let registry = scenario.take_shared<Registry>();
    let id = hatchery::publish(&registry, blob(), scenario.ctx());
    let events = event::events_by_type<Published>();
    assert!(events.length() == 1);
    assert!(
        events[0] == hatchery::new_published_for_testing(id, AUTHOR, blob(), option::none()),
    );
    ts::return_shared(registry);

    scenario.next_tx(STRANGER);
    let template = scenario.take_immutable_by_id<Template>(id);
    assert!(hatchery::author(&template) == AUTHOR);
    assert!(hatchery::blob_id(&template) == &blob());
    assert!(hatchery::parent(&template).is_none());
    assert!(hatchery::template_version(&template) == 1);
    ts::return_immutable(template);
    scenario.end();
}

#[test]
fun a_derived_template_records_its_parent() {
    let (mut scenario, parent_id) = published();
    scenario.next_tx(HATCHER);
    let registry = scenario.take_shared<Registry>();
    let parent = scenario.take_immutable_by_id<Template>(parent_id);
    let remix = b"remix-blob-id-0000000000000000000000000000".to_string();
    let child_id = hatchery::publish_derived(&registry, &parent, remix, scenario.ctx());
    let events = event::events_by_type<Published>();
    assert!(
        events[0] == hatchery::new_published_for_testing(child_id, HATCHER, remix, option::some(parent_id)),
    );
    ts::return_immutable(parent);
    ts::return_shared(registry);

    scenario.next_tx(HATCHER);
    let child = scenario.take_immutable_by_id<Template>(child_id);
    assert!(hatchery::parent(&child) == &option::some(parent_id));
    assert!(hatchery::author(&child) == HATCHER);
    ts::return_immutable(child);
    scenario.end();
}

#[test]
fun anyone_can_hatch_and_the_fork_names_both_sides() {
    let (mut scenario, id) = published();
    scenario.next_tx(HATCHER);
    let registry = scenario.take_shared<Registry>();
    let template = scenario.take_immutable_by_id<Template>(id);
    hatchery::fork(&registry, &template, scenario.ctx());
    let events = event::events_by_type<Forked>();
    assert!(events.length() == 1);
    assert!(events[0] == hatchery::new_forked_for_testing(id, AUTHOR, HATCHER));
    ts::return_immutable(template);
    ts::return_shared(registry);
    scenario.end();
}

#[test]
fun the_author_can_deprecate() {
    let (mut scenario, id) = published();
    let registry = scenario.take_shared<Registry>();
    let template = scenario.take_immutable_by_id<Template>(id);
    hatchery::deprecate(&registry, &template, scenario.ctx());
    let events = event::events_by_type<Deprecated>();
    assert!(events[0] == hatchery::new_deprecated_for_testing(id, AUTHOR));
    ts::return_immutable(template);
    ts::return_shared(registry);
    scenario.end();
}

#[test, expected_failure(abort_code = hatchery::ENotAuthor)]
fun a_stranger_cannot_deprecate() {
    let (mut scenario, id) = published();
    scenario.next_tx(STRANGER);
    let registry = scenario.take_shared<Registry>();
    let template = scenario.take_immutable_by_id<Template>(id);
    hatchery::deprecate(&registry, &template, scenario.ctx());
    abort
}

#[test, expected_failure(abort_code = hatchery::EBadBlobId)]
fun an_empty_blob_id_is_refused() {
    let mut scenario = ts::begin(AUTHOR);
    hatchery::init_for_testing(scenario.ctx());
    scenario.next_tx(AUTHOR);
    let registry = scenario.take_shared<Registry>();
    hatchery::publish(&registry, b"".to_string(), scenario.ctx());
    abort
}

#[test, expected_failure(abort_code = hatchery::EBadBlobId)]
fun an_oversized_blob_id_is_refused() {
    let mut scenario = ts::begin(AUTHOR);
    hatchery::init_for_testing(scenario.ctx());
    scenario.next_tx(AUTHOR);
    let registry = scenario.take_shared<Registry>();
    let mut long = vector[];
    129u64.do!(|_| long.push_back(b"a"[0]));
    hatchery::publish(&registry, long.to_string(), scenario.ctx());
    abort
}

#[test, expected_failure(abort_code = hatchery::EWrongVersion)]
fun an_outdated_registry_blocks_publish() {
    let mut scenario = ts::begin(AUTHOR);
    hatchery::init_for_testing(scenario.ctx());
    scenario.next_tx(AUTHOR);
    let mut registry = scenario.take_shared<Registry>();
    hatchery::set_version_for_testing(&mut registry, 0);
    hatchery::publish(&registry, blob(), scenario.ctx());
    abort
}

#[test, expected_failure(abort_code = hatchery::EWrongVersion)]
fun an_outdated_registry_blocks_hatching() {
    let (mut scenario, id) = published();
    scenario.next_tx(HATCHER);
    let mut registry = scenario.take_shared<Registry>();
    hatchery::set_version_for_testing(&mut registry, 0);
    let template = scenario.take_immutable_by_id<Template>(id);
    hatchery::fork(&registry, &template, scenario.ctx());
    abort
}

#[test]
fun migrate_moves_the_registry_forward_once() {
    let mut scenario = ts::begin(AUTHOR);
    hatchery::init_for_testing(scenario.ctx());
    scenario.next_tx(STRANGER);
    let mut registry = scenario.take_shared<Registry>();
    hatchery::set_version_for_testing(&mut registry, 0);
    hatchery::migrate_registry(&mut registry);
    assert!(hatchery::registry_version(&registry) == 1);
    ts::return_shared(registry);
    scenario.end();
}

#[test, expected_failure(abort_code = hatchery::ENotUpgrade)]
fun migrate_refuses_a_current_registry() {
    let mut scenario = ts::begin(AUTHOR);
    hatchery::init_for_testing(scenario.ctx());
    scenario.next_tx(STRANGER);
    let mut registry = scenario.take_shared<Registry>();
    hatchery::migrate_registry(&mut registry);
    abort
}
