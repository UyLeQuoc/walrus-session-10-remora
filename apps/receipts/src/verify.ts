/**
 * `/verify` (RC2, ADR-0061): checks a receipt against the chain, not against our database. A stranger
 * can run the same checks with the receipt JSON and any Sui node.
 */
import type { Anchorer } from "./chain.ts";
import { leafHash, rootFromProof } from "./merkle.ts";
import type { Receipt } from "./picks.ts";

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export async function verifyReceipt(anchorer: Pick<Anchorer, "read">, r: Receipt) {
  const checks: Check[] = [];
  const leaf = leafHash(r.pick);
  checks.push({
    name: "pick matches its leaf",
    ok: leaf === r.leaf,
    detail: leaf === r.leaf ? leaf : `recomputed ${leaf}, receipt says ${r.leaf}`,
  });
  if (!r.anchor) {
    checks.push({
      name: "anchored on Sui",
      ok: false,
      detail: "not anchored yet; the next batch is within 10 minutes",
    });
    return { ok: false, checks };
  }
  const onchain = await anchorer.read(r.anchor.digest);
  checks.push({
    name: "anchor transaction on Sui",
    ok: !!onchain?.success,
    detail: onchain
      ? `${r.anchor.digest} (${onchain.count} picks)`
      : `${r.anchor.digest} not found`,
  });
  const root = rootFromProof(leaf, r.proof);
  checks.push({
    name: "proof reaches the onchain root",
    ok: !!onchain && root === onchain.root,
    detail: onchain
      ? `computed ${root.slice(0, 16)}…, onchain ${onchain.root.slice(0, 16)}…`
      : "no onchain root",
  });
  const locksAt = Date.parse(r.event.locksAt);
  checks.push({
    name: "anchored before lock",
    ok: !!onchain && onchain.tsMs <= locksAt,
    detail: onchain
      ? `anchored ${new Date(onchain.tsMs).toISOString()}, locked ${r.event.locksAt}`
      : "no onchain time",
  });
  return { ok: checks.every((c) => c.ok), checks };
}
