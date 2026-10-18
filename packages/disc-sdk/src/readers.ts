import { normalizeSuiAddress } from "@mysten/sui/utils";
import { AllowanceBcs, AllowanceCapBcs, DiscBcs, DiscKeyBcs, PaidBcs, RegistryBcs } from "./bcs.ts";
import { allowanceCapType, type DiscConfig, discType } from "./config.ts";

/** The slice of `SuiGrpcClient.core` the readers use, so tests can fake it. */
export interface ObjectReader {
  getObject(o: {
    objectId: string;
    include: { content: true };
  }): Promise<{ object: { objectId: string; type: string; content: Uint8Array } }>;
  getDynamicField(o: {
    parentId: string;
    name: { type: string; bcs: Uint8Array };
  }): Promise<{ dynamicField: { value: { bcs: Uint8Array } } }>;
  listOwnedObjects(o: {
    owner: string;
    type: string;
    cursor?: string | null;
    include: { content: true };
  }): Promise<{
    objects: { objectId: string; content: Uint8Array }[];
    hasNextPage: boolean;
    cursor: string | null;
  }>;
}

export interface DiscState {
  id: string;
  owner: string;
  name: string;
  payees: string[];
  perPaymentCap: bigint;
  paused: boolean;
  version: number;
}

export interface AllowanceState {
  id: string;
  funder: string;
  spender: string | null;
  /** `<package>::disc::DISC` for Disc-bound allowances. */
  app: string | null;
  lifetimeCap: bigint | null;
  startMs: number | null;
  expiryMs: number | null;
  rateLimit: { limit: bigint; spent: bigint; periodMs?: number; months?: number } | null;
  name: string;
  currentSpend: bigint;
}

export interface PaidEvent {
  disc: string;
  payee: string;
  amount: bigint;
  intent: Uint8Array;
  tsMs: number;
}

export function decodeDisc(content: Uint8Array): DiscState {
  const d = DiscBcs.parse(content);
  return {
    id: d.id,
    owner: d.owner,
    name: d.name,
    payees: d.payees.contents,
    perPaymentCap: BigInt(d.per_payment_cap),
    paused: d.paused,
    version: Number(d.version),
  };
}

export function decodeAllowance(content: Uint8Array): AllowanceState {
  const a = AllowanceBcs.parse(content);
  const s = a.settings;
  const rl = s.rate_limit?.Windowed;
  return {
    id: a.id,
    funder: s.funder,
    spender: s.spender ?? null,
    app: s.app ? `0x${s.app.name}` : null,
    lifetimeCap: s.lifetime_cap != null ? BigInt(s.lifetime_cap) : null,
    startMs: s.start_timestamp_ms != null ? Number(s.start_timestamp_ms) : null,
    expiryMs: s.expiration_timestamp_ms != null ? Number(s.expiration_timestamp_ms) : null,
    rateLimit: rl
      ? {
          limit: BigInt(rl.limit),
          spent: BigInt(rl.spent),
          ...(rl.window.PeriodicMs != null ? { periodMs: Number(rl.window.PeriodicMs) } : {}),
          ...(rl.window.CalendarMonths != null ? { months: rl.window.CalendarMonths } : {}),
        }
      : null,
    name: s.name,
    currentSpend: BigInt(a.current_spend),
  };
}

export function decodePaid(bytes: Uint8Array): PaidEvent {
  const p = PaidBcs.parse(bytes);
  return {
    disc: p.disc,
    payee: p.payee,
    amount: BigInt(p.amount),
    intent: Uint8Array.from(p.intent),
    tsMs: Number(p.ts_ms),
  };
}

/** `Paid` events of this package in a transaction's events (from `getTransaction({ include: { events } })`). */
export function paidEvents(
  cfg: DiscConfig,
  events: { eventType: string; bcs: Uint8Array }[] | null | undefined,
): PaidEvent[] {
  const type = normalizeType(discType(cfg, "Paid"));
  return (events ?? [])
    .filter((e) => normalizeType(e.eventType) === type)
    .map((e) => decodePaid(e.bcs));
}

/** Package addresses can come back with or without padding; compare normalized. */
export function normalizeType(type: string): string {
  return type.replace(/0x[0-9a-fA-F]+/g, (addr) => normalizeSuiAddress(addr));
}

export async function getDisc(client: ObjectReader, discId: string): Promise<DiscState> {
  const { object } = await client.getObject({ objectId: discId, include: { content: true } });
  return decodeDisc(object.content);
}

export async function getAllowance(
  client: ObjectReader,
  allowanceId: string,
): Promise<AllowanceState> {
  const { object } = await client.getObject({ objectId: allowanceId, include: { content: true } });
  return decodeAllowance(object.content);
}

/** The live Disc for `(owner, name)`, from the registry table; null when there's none. */
export async function findDiscId(
  client: ObjectReader,
  cfg: DiscConfig,
  owner: string,
  name: string,
): Promise<string | null> {
  const { object } = await client.getObject({
    objectId: cfg.registryId,
    include: { content: true },
  });
  const registry = RegistryBcs.parse(object.content);
  try {
    const { dynamicField } = await client.getDynamicField({
      parentId: registry.discs.id,
      name: {
        type: discType(cfg, "DiscKey"),
        bcs: DiscKeyBcs.serialize({ owner, name }).toBytes(),
      },
    });
    return normalizeSuiAddress(
      Array.from(dynamicField.value.bcs, (b) => b.toString(16).padStart(2, "0")).join(""),
    );
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export interface OwnedDisc {
  disc: DiscState;
  allowance: AllowanceState;
  capId: string;
}

/**
 * An owner's Discs for `cfg.coinType`: their soulbound `AllowanceCap`s → allowances bound to this
 * package's `DISC` → the registry. Allowances revoked outside `disc::revoke` drop out.
 */
export async function listOwnerDiscs(
  client: ObjectReader,
  cfg: DiscConfig,
  owner: string,
): Promise<OwnedDisc[]> {
  const app = normalizeType(discType(cfg, "DISC"));
  const out: OwnedDisc[] = [];
  let cursor: string | null = null;
  do {
    const page = await client.listOwnedObjects({
      owner,
      type: allowanceCapType(cfg),
      cursor,
      include: { content: true },
    });
    for (const capObj of page.objects) {
      const cap = AllowanceCapBcs.parse(capObj.content);
      const allowance = await getAllowance(client, cap.allowance);
      if (!allowance.app || normalizeType(allowance.app) !== app) continue;
      const discId = await findDiscId(client, cfg, owner, allowance.name);
      if (!discId) continue;
      out.push({ disc: await getDisc(client, discId), allowance, capId: capObj.objectId });
    }
    cursor = page.hasNextPage ? page.cursor : null;
  } while (cursor);
  return out;
}

function isNotFound(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null;
  return (
    e?.code === "NOT_FOUND" || (typeof e?.message === "string" && /not found/i.test(e.message))
  );
}
