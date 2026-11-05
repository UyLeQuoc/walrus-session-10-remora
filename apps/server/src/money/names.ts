/**
 * C1 (ADR-0144): `.sui` names over gRPC `sui.rpc.v2.NameService` (LookupName, ReverseLookupName),
 * through the client and transport every other read uses: no JSON-RPC, no `@mysten/suins`.
 * - a contact added by name keeps the name, the address the owner signed for, and when it was
 *   resolved; before each payment the name is resolved again, and a name that now points elsewhere
 *   stops the payment (ADR-0109: only the signed address is ever paid);
 * - reverse lookups show names beside addresses, cached for an hour.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";

/** `linh.sui`, `team.linh.sui`, or `@linh` (SuiNS's short form). */
export const SUI_NAME = /^(?:@[a-z0-9-]{3,63}|(?:[a-z0-9-]{1,63}\.)+sui)$/i;
export const isSuiName = (s: string) => SUI_NAME.test(s.trim());

/** `@linh` → `linh.sui`; lowercased. */
export const canonicalName = (s: string) => {
  const t = s.trim().toLowerCase();
  return t.startsWith("@") ? `${t.slice(1)}.sui` : t;
};

export interface NameCore {
  resolveNameServiceAddress(i: { name: string }): Promise<{ address: string | null }>;
  defaultNameServiceName(i: { address: string }): Promise<{ data: { name: string | null } }>;
}

export async function resolveName(core: NameCore, name: string): Promise<string | null> {
  const { address } = await core.resolveNameServiceAddress({ name: canonicalName(name) });
  return address ? normalizeSuiAddress(address) : null;
}

const HOUR = 3_600_000;
const reverse = new Map<string, { at: number; name: string | null }>();

/** The address's default name, or null; cached an hour (a miss is cached too). */
export async function nameOf(core: NameCore, address: string, now = Date.now()) {
  const key = normalizeSuiAddress(address);
  const hit = reverse.get(key);
  if (hit && now - hit.at < HOUR) return hit.name;
  const name = await core
    .defaultNameServiceName({ address: key })
    .then((r) => r.data.name ?? null)
    .catch(() => null);
  reverse.set(key, { at: now, name });
  if (reverse.size > 5_000) reverse.delete(reverse.keys().next().value as string);
  return name;
}

/** Names for many addresses at once (unique, at most 50). */
export async function namesOf(core: NameCore, addresses: string[]) {
  const uniq = [...new Set(addresses.map((a) => normalizeSuiAddress(a)))].slice(0, 50);
  const out: Record<string, string> = {};
  await Promise.all(
    uniq.map(async (a) => {
      const n = await nameOf(core, a);
      if (n) out[a] = n;
    }),
  );
  return out;
}

/**
 * Before paying a contact added by name: the name must still point at the address the owner signed
 * for. Returns null when it does (or the contact has no name), else what changed.
 */
export async function nameMoved(
  core: NameCore,
  c: { suins?: string; address: string },
): Promise<{ name: string; now: string | null } | null> {
  if (!c.suins) return null;
  const now = await resolveName(core, c.suins);
  return now === normalizeSuiAddress(c.address) ? null : { name: c.suins, now };
}
