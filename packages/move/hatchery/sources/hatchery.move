/// The Hatchery's provenance (M6, ADR-0012, ADR-0047): who published a shared remora, which Walrus
/// blob holds it, what it was derived from, and who hatched it.
///
/// A `Template` is frozen when it's published, so its author, blob and parent never change: a new
/// version is a new `Template` whose parent is the old one. Hatching a template records `Forked` (in
/// the same transaction that issues the hatcher's Discs); deprecating records `Deprecated`. Fork
/// counts and the deprecated flag are read from these events by the checkpoint indexer, since gRPC
/// has no event queries (ADR-0021).
///
/// Upgrades (I6): the shared `Registry` carries the version every entry point checks, and moves
/// forward with `migrate_registry`. Frozen templates can't migrate, so they only have to be no newer
/// than the package.
module remora_hatchery::hatchery;

use std::string::String;
use sui::event;

/// Bumped on every upgrade that changes object semantics.
const VERSION: u64 = 1;
/// Walrus blob ids are 43-character base64url strings; leave room for other encodings.
const MAX_BLOB_ID_LENGTH: u64 = 128;

#[error(code = 1)]
const EWrongVersion: vector<u8> = "Object version doesn't match the package; migrate it";
#[error(code = 2)]
const ENotAuthor: vector<u8> = "Only the template's author can do this";
#[error(code = 3)]
const EBadBlobId: vector<u8> = "Blob id must be 1 to 128 bytes";
#[error(code = 4)]
const ENotUpgrade: vector<u8> = "Object is already at the current version";

/// Shared. The version gate.
public struct Registry has key {
    id: UID,
    version: u64,
}

/// Frozen at publish. One published version of a shared remora or team.
public struct Template has key {
    id: UID,
    author: address,
    /// The Walrus blob holding the `remora.team/v1` file (ADR-0046).
    blob_id: String,
    /// The template this one was derived from: an earlier version, or someone else's template.
    parent: Option<ID>,
    version: u64,
}

// === Events (the indexer reads them from checkpoints) ===

public struct Published has copy, drop {
    template: ID,
    author: address,
    blob_id: String,
    parent: Option<ID>,
}

/// Someone hatched `template` into their own account.
public struct Forked has copy, drop {
    template: ID,
    author: address,
    by: address,
}

public struct Deprecated has copy, drop {
    template: ID,
    author: address,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(Registry { id: object::new(ctx), version: VERSION });
}

/// Publishes a new template; the sender is its author.
public fun publish(registry: &Registry, blob_id: String, ctx: &mut TxContext): ID {
    publish_with_parent(registry, blob_id, option::none(), ctx)
}

/// Publishes a template derived from `parent` (a new version, or a remix of someone else's).
public fun publish_derived(
    registry: &Registry,
    parent: &Template,
    blob_id: String,
    ctx: &mut TxContext,
): ID {
    assert_template(parent);
    publish_with_parent(registry, blob_id, option::some(object::id(parent)), ctx)
}

/// Records that the sender hatched `template`. The hatch's Disc issues go in the same transaction.
public fun fork(registry: &Registry, template: &Template, ctx: &mut TxContext) {
    assert_registry(registry);
    assert_template(template);
    event::emit(Forked {
        template: object::id(template),
        author: template.author,
        by: ctx.sender(),
    });
}

/// Marks a template as no longer recommended. Only its author can; the blob and object stay.
public fun deprecate(registry: &Registry, template: &Template, ctx: &mut TxContext) {
    assert_registry(registry);
    assert_template(template);
    assert!(ctx.sender() == template.author, ENotAuthor);
    event::emit(Deprecated { template: object::id(template), author: template.author });
}

/// Moves the registry to this package's `VERSION`. Only ever forward, so anyone may call it.
public fun migrate_registry(registry: &mut Registry) {
    assert!(registry.version < VERSION, ENotUpgrade);
    registry.version = VERSION;
}

// === Reads ===

public fun author(template: &Template): address { template.author }

public fun blob_id(template: &Template): &String { &template.blob_id }

public fun parent(template: &Template): &Option<ID> { &template.parent }

public fun template_version(template: &Template): u64 { template.version }

public fun registry_version(registry: &Registry): u64 { registry.version }

// === Internal ===

fun publish_with_parent(
    registry: &Registry,
    blob_id: String,
    parent: Option<ID>,
    ctx: &mut TxContext,
): ID {
    assert_registry(registry);
    let length = blob_id.length();
    assert!(length > 0 && length <= MAX_BLOB_ID_LENGTH, EBadBlobId);
    let template = Template {
        id: object::new(ctx),
        author: ctx.sender(),
        blob_id,
        parent,
        version: VERSION,
    };
    let id = object::id(&template);
    event::emit(Published { template: id, author: template.author, blob_id, parent });
    transfer::freeze_object(template);
    id
}

fun assert_registry(registry: &Registry) {
    assert!(registry.version == VERSION, EWrongVersion);
}

fun assert_template(template: &Template) {
    assert!(template.version <= VERSION, EWrongVersion);
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun set_version_for_testing(registry: &mut Registry, version: u64) {
    registry.version = version;
}

#[test_only]
public fun new_published_for_testing(
    template: ID,
    author: address,
    blob_id: String,
    parent: Option<ID>,
): Published {
    Published { template, author, blob_id, parent }
}

#[test_only]
public fun new_forked_for_testing(template: ID, author: address, by: address): Forked {
    Forked { template, author, by }
}

#[test_only]
public fun new_deprecated_for_testing(template: ID, author: address): Deprecated {
    Deprecated { template, author }
}
