import { bcs } from "@mysten/sui/bcs";

/** BCS layouts of the Move objects and events the SDK reads. Field order must match the Move source. */

const VecSetAddress = bcs.struct("VecSet<address>", { contents: bcs.vector(bcs.Address) });

export const DiscBcs = bcs.struct("Disc", {
  id: bcs.Address,
  owner: bcs.Address,
  name: bcs.string(),
  payees: VecSetAddress,
  per_payment_cap: bcs.u64(),
  paused: bcs.bool(),
  version: bcs.u64(),
});

export const DiscKeyBcs = bcs.struct("DiscKey", { owner: bcs.Address, name: bcs.string() });

export const RegistryBcs = bcs.struct("Registry", {
  id: bcs.Address,
  discs: bcs.struct("Table", { id: bcs.Address, size: bcs.u64() }),
  version: bcs.u64(),
});

export const PaidBcs = bcs.struct("Paid", {
  disc: bcs.Address,
  payee: bcs.Address,
  amount: bcs.u64(),
  intent: bcs.vector(bcs.u8()),
  ts_ms: bcs.u64(),
});

const Window = bcs.enum("Window", { PeriodicMs: bcs.u64(), CalendarMonths: bcs.u8() });

const RateLimit = bcs.enum("RateLimit", {
  Windowed: bcs.struct("Windowed", {
    limit: bcs.u256(),
    spent: bcs.u256(),
    anchor_ms: bcs.option(bcs.u64()),
    index: bcs.u64(),
    window: Window,
  }),
});

/** `sui::allowance::Allowance<T>` as of framework 1.82. */
export const AllowanceBcs = bcs.struct("Allowance", {
  id: bcs.Address,
  settings: bcs.struct("Settings", {
    funder: bcs.Address,
    spender: bcs.option(bcs.Address),
    app: bcs.option(bcs.struct("TypeName", { name: bcs.string() })),
    lifetime_cap: bcs.option(bcs.u256()),
    start_timestamp_ms: bcs.option(bcs.u64()),
    expiration_timestamp_ms: bcs.option(bcs.u64()),
    rate_limit: bcs.option(RateLimit),
    name: bcs.string(),
  }),
  current_spend: bcs.u256(),
});

export const AllowanceCapBcs = bcs.struct("AllowanceCap", {
  id: bcs.Address,
  allowance: bcs.Address,
});

export const DiscIssuedBcs = bcs.struct("DiscIssued", {
  disc: bcs.Address,
  owner: bcs.Address,
  name: bcs.string(),
  spender: bcs.Address,
  payees: bcs.vector(bcs.Address),
  per_payment_cap: bcs.u64(),
});

export const DiscUpdatedBcs = bcs.struct("DiscUpdated", {
  disc: bcs.Address,
  payees: bcs.vector(bcs.Address),
  per_payment_cap: bcs.u64(),
  paused: bcs.bool(),
});

export const SpenderRotatedBcs = bcs.struct("SpenderRotated", {
  disc: bcs.Address,
  new_spender: bcs.Address,
});

export const DiscRevokedBcs = bcs.struct("DiscRevoked", { disc: bcs.Address });

/** Every `remora::disc` event the indexer stores, by struct name. */
export const DISC_EVENT_BCS = {
  Paid: PaidBcs,
  DiscIssued: DiscIssuedBcs,
  DiscUpdated: DiscUpdatedBcs,
  SpenderRotated: SpenderRotatedBcs,
  DiscRevoked: DiscRevokedBcs,
} as const;
export type DiscEventName = keyof typeof DISC_EVENT_BCS;
