import { bcs } from "@mysten/sui/bcs";
import { normalizeSuiAddress, toHex } from "@mysten/sui/utils";

const PREFIX_HEX = toHex(new TextEncoder().encode("hippo-doc"));

/**
 * The Seal identity of a file: `hippo-doc`, the account owner's 32 bytes, then
 * the account's access counter as a little-endian u64. `seal_approve` checks
 * the owner and counter suffix and ignores the prefix, so this is the same
 * policy that unseals the owner's memories (docs/SPIKES.md §14).
 */
export function documentSealId(owner: string, counter: bigint): string {
  const ownerHex = normalizeSuiAddress(owner).slice(2);
  return `${PREFIX_HEX}${ownerHex}${toHex(bcs.u64().serialize(counter).toBytes())}`;
}

export function accessCounter(json: unknown): bigint | null {
  if (!json || typeof json !== "object") return null;
  const raw = (json as { access_counter_version?: unknown }).access_counter_version;
  if (typeof raw === "string" && /^\d+$/.test(raw)) return BigInt(raw);
  if (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) return BigInt(raw);
  return null;
}
