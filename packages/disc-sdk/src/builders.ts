import { bcs } from "@mysten/sui/bcs";
import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";
import { balanceType, CLOCK_ID, type DiscConfig, discType } from "./config.ts";

export type RateLimitSpec = { periodMs: number; limit: bigint } | { months: number; limit: bigint };

export interface IssueArgs {
  /** Unique per owner among live Discs (the registry key). */
  name: string;
  /** The remora's key. */
  spender: string;
  lifetimeCap?: bigint;
  startMs?: number;
  expiryMs?: number;
  rateLimit?: RateLimitSpec;
  payees: string[];
  perPaymentCap: bigint;
}

export interface PayArgs {
  discId: string;
  allowanceId: string;
  /** The Disc's owner, whose address balance pays. */
  funder: string;
  payee: string;
  amount: bigint;
  /** sha256 of the Wake's intent (G2). */
  intent: Uint8Array;
}

export interface RevokeArgs {
  discId: string;
  capId: string;
  allowanceId: string;
}

/** Mirrors the framework's issuance rules so a bad Disc fails here instead of onchain. */
export function validateIssue(a: IssueArgs): void {
  if (a.lifetimeCap === undefined && !a.rateLimit) {
    throw new Error("a Disc needs a lifetime cap or a rate limit");
  }
  if (a.expiryMs === undefined && !a.rateLimit) {
    throw new Error("a Disc needs an expiry or a rate limit");
  }
  if (a.perPaymentCap <= 0n) throw new Error("perPaymentCap must be greater than zero");
  if (new Set(a.payees).size !== a.payees.length) throw new Error("payees must be unique");
  if (new TextEncoder().encode(a.name).length > 128)
    throw new Error("name is longer than 128 bytes");
}

function rateLimitArg(tx: Transaction, spec?: RateLimitSpec): TransactionArgument {
  const typeArguments = ["0x2::allowance::RateLimit"];
  if (!spec) return tx.moveCall({ target: "0x1::option::none", typeArguments });
  const limit =
    "periodMs" in spec
      ? tx.moveCall({
          target: "0x2::allowance::periodic_rate_limit",
          arguments: [tx.pure.u64(spec.periodMs), tx.pure.u256(spec.limit)],
        })
      : tx.moveCall({
          target: "0x2::allowance::calendar_rate_limit",
          arguments: [tx.pure.u8(spec.months), tx.pure.u256(spec.limit)],
        });
  return tx.moveCall({ target: "0x1::option::some", typeArguments, arguments: [limit] });
}

/** Owner: `propose_for_app<Balance<C>, DISC>` → `disc::issue`. Returns the new Disc's ID argument. */
export function addIssue(tx: Transaction, cfg: DiscConfig, a: IssueArgs) {
  validateIssue(a);
  const proposal = tx.moveCall({
    target: "0x2::allowance::propose_for_app",
    typeArguments: [balanceType(cfg), discType(cfg, "DISC")],
    arguments: [
      tx.pure.string(a.name),
      tx.pure.address(a.spender),
      tx.pure(bcs.option(bcs.u256()).serialize(a.lifetimeCap ?? null)),
      tx.pure(bcs.option(bcs.u64()).serialize(a.startMs ?? null)),
      tx.pure(bcs.option(bcs.u64()).serialize(a.expiryMs ?? null)),
      rateLimitArg(tx, a.rateLimit),
    ],
  });
  return tx.moveCall({
    target: `${cfg.packageId}::disc::issue`,
    typeArguments: [cfg.coinType],
    arguments: [
      tx.object(cfg.registryId),
      proposal,
      tx.pure.vector("address", a.payees),
      tx.pure.u64(a.perPaymentCap),
    ],
  });
}

export function buildIssue(cfg: DiscConfig, a: IssueArgs): Transaction {
  const tx = new Transaction();
  addIssue(tx, cfg, a);
  return tx;
}

/**
 * Spender (remora key) pays from the funder's address balance through the allowance. Pass `gasOwner`
 * for sponsored gas; the sponsor must never be a funder (ADR-0020).
 */
export function buildPay(
  cfg: DiscConfig,
  a: PayArgs,
  signers: { sender: string; gasOwner?: string },
): Transaction {
  if (a.intent.length !== 32) throw new Error("intent must be a 32-byte sha256 digest");
  if (a.amount <= 0n) throw new Error("amount must be greater than zero");
  const tx = new Transaction();
  tx.setSender(signers.sender);
  if (signers.gasOwner) tx.setGasOwner(signers.gasOwner);
  const withdrawal = tx.withdrawal({
    from: "allowance",
    allowance: a.allowanceId,
    funder: a.funder,
    amount: a.amount,
    type: cfg.coinType,
  });
  tx.moveCall({
    target: `${cfg.packageId}::disc::pay`,
    typeArguments: [cfg.coinType],
    arguments: [
      tx.object(a.discId),
      tx.object(a.allowanceId),
      withdrawal,
      tx.pure.address(a.payee),
      tx.pure.vector("u8", Array.from(a.intent)),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

export function addRotate(
  tx: Transaction,
  cfg: DiscConfig,
  a: { discId: string; allowanceId: string; newSpender: string },
) {
  tx.moveCall({
    target: `${cfg.packageId}::disc::rotate`,
    typeArguments: [cfg.coinType],
    arguments: [tx.object(a.discId), tx.object(a.allowanceId), tx.pure.address(a.newSpender)],
  });
}

export function buildRotate(
  cfg: DiscConfig,
  a: { discId: string; allowanceId: string; newSpender: string },
): Transaction {
  const tx = new Transaction();
  addRotate(tx, cfg, a);
  return tx;
}

/** The panic button (N10) passes every Disc of the owner. */
export function buildPause(cfg: DiscConfig, discIds: string[], paused: boolean): Transaction {
  const tx = new Transaction();
  for (const id of discIds) {
    tx.moveCall({
      target: `${cfg.packageId}::disc::pause`,
      arguments: [tx.object(id), tx.pure.bool(paused)],
    });
  }
  return tx;
}

export function buildSetPayees(cfg: DiscConfig, discId: string, payees: string[]): Transaction {
  if (new Set(payees).size !== payees.length) throw new Error("payees must be unique");
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::disc::set_payees`,
    arguments: [tx.object(discId), tx.pure.vector("address", payees)],
  });
  return tx;
}

export function buildSetPerPaymentCap(cfg: DiscConfig, discId: string, cap: bigint): Transaction {
  if (cap <= 0n) throw new Error("cap must be greater than zero");
  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::disc::set_per_payment_cap`,
    arguments: [tx.object(discId), tx.pure.u64(cap)],
  });
  return tx;
}

export function addRevoke(tx: Transaction, cfg: DiscConfig, a: RevokeArgs) {
  tx.moveCall({
    target: `${cfg.packageId}::disc::revoke`,
    typeArguments: [cfg.coinType],
    arguments: [
      tx.object(cfg.registryId),
      tx.object(a.discId),
      tx.object(a.capId),
      tx.object(a.allowanceId),
    ],
  });
}

export function buildRevoke(cfg: DiscConfig, a: RevokeArgs): Transaction {
  const tx = new Transaction();
  addRevoke(tx, cfg, a);
  return tx;
}

/** Budget change (B7): revoke + reissue in one owner PTB. The name may stay the same. */
export function buildRevokeAndReissue(
  cfg: DiscConfig,
  a: RevokeArgs,
  next: IssueArgs,
): Transaction {
  validateIssue(next);
  const tx = new Transaction();
  addRevoke(tx, cfg, a);
  addIssue(tx, cfg, next);
  return tx;
}
