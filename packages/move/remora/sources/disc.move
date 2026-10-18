/// U1 spike stub of the Disc (ADR-0003): an app-bound native allowance plus the app's own policy,
/// a payee allowlist and a per-payment cap. The real Disc is E1.
///
/// `allowance::issue` doesn't return the new allowance's ID, so a policy is keyed by the
/// allowance's `(funder, name)`. `issue` refuses a key that's already taken, and every DISC-bound
/// allowance must come through `issue`, so each allowance maps to exactly one policy.
module remora::disc;

use std::internal;
use std::string::String;
use sui::allowance::{Self, Allowance, AllowanceCap, AllowanceProposal, AllowanceWithdrawal};
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::table::{Self, Table};

#[error(code = 1)]
const EPolicyExists: vector<u8> = "A policy with this funder and name already exists";
#[error(code = 2)]
const ENoPolicy: vector<u8> = "No policy for this allowance";
#[error(code = 3)]
const EPayeeNotAllowed: vector<u8> = "Payee is not on the allowlist";
#[error(code = 4)]
const EOverPaymentCap: vector<u8> = "Payment exceeds the per-payment cap";
#[error(code = 5)]
const ENotFunder: vector<u8> = "Only the funder can do this";

/// The app type allowances are bound to. Its name makes it this module's one-time witness too.
public struct DISC has drop {}

public struct PolicyKey has copy, drop, store {
    funder: address,
    name: String,
}

public struct Policy has drop, store {
    payees: vector<address>,
    max_per_payment: u64,
}

public struct Registry has key {
    id: UID,
    policies: Table<PolicyKey, Policy>,
}

fun init(_otw: DISC, ctx: &mut TxContext) {
    transfer::share_object(Registry { id: object::new(ctx), policies: table::new(ctx) });
}

/// Owner, in the same PTB as `allowance::propose_for_app<Balance<C>, DISC>`.
public fun issue<C>(
    registry: &mut Registry,
    proposal: AllowanceProposal<Balance<C>>,
    payees: vector<address>,
    max_per_payment: u64,
    ctx: &mut TxContext,
) {
    let settings = proposal.settings();
    let key = PolicyKey { funder: settings.funder(), name: *settings.name() };
    assert!(!registry.policies.contains(key), EPolicyExists);
    registry.policies.add(key, Policy { payees, max_per_payment });
    allowance::issue(proposal, allowance::settings_permit(internal::permit<DISC>()), ctx);
}

/// Spender: pays `payee` from the funder's address balance under the allowance. The amount is the
/// withdrawal's. The native module checks the spender, window, lifetime cap and rate limit.
public fun pay<C>(
    registry: &Registry,
    allowance: &mut Allowance<Balance<C>>,
    withdrawal: AllowanceWithdrawal<Balance<C>>,
    payee: address,
    clock: &Clock,
    ctx: &TxContext,
) {
    let settings = allowance.settings();
    let key = PolicyKey { funder: settings.funder(), name: *settings.name() };
    assert!(registry.policies.contains(key), ENoPolicy);
    let policy = &registry.policies[key];
    assert!(policy.payees.contains(&payee), EPayeeNotAllowed);

    let permit = allowance::spend_permit(internal::permit<DISC>());
    let paid = allowance::app_balance_spend(allowance, permit, withdrawal, clock, ctx);
    assert!(paid.value() <= policy.max_per_payment, EOverPaymentCap);
    balance::send_funds(paid, payee);
}

/// Owner: deletes the allowance and frees its policy key.
public fun revoke<C>(
    registry: &mut Registry,
    cap: AllowanceCap<Balance<C>>,
    allowance: Allowance<Balance<C>>,
    ctx: &TxContext,
) {
    let settings = allowance.settings();
    assert!(settings.funder() == ctx.sender(), ENotFunder);
    let key = PolicyKey { funder: settings.funder(), name: *settings.name() };
    if (registry.policies.contains(key)) {
        registry.policies.remove(key);
    };
    allowance::revoke(cap, allowance);
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(DISC {}, ctx);
}
