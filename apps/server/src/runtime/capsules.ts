/**
 * U18 A4 (ADR-0130): lend a remora's memories to another owner's remora, and take them back. The
 * owner picks memories (by recall, so the text is the stored text), the server Seal-encrypts them to a
 * fresh key id under `remora_capsule` and stores the blob on Walrus, and the owner signs one `create`.
 * The grantee's owner accepts the offer; from then on the grantee decrypts at answer time with its own
 * key, never keeping the plaintext, so a revoke (one signature) or the expiry ends access next turn.
 */

import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress, toHex } from "@mysten/sui/utils";
import { and, desc, eq, remoraEvents, remoras, sql } from "@remora/db";
import { decryptCapsule, encryptCapsule, readFromWalrus, storeOnWalrus } from "@remora/memory";
import { DEPLOYMENTS } from "@remora/schema";
import type { Listings } from "../money/listings.ts";
import type { UntrustedData } from "./brain.ts";
import { saveConfig } from "./config-versions.ts";
import type { RuntimeDeps } from "./deps.ts";
import { type Remora, RemoraError } from "./remoras.ts";

const DAY_MS = 86_400_000;
export const CAPSULE_LIMITS = { memories: 20, days: 30 } as const;

export interface AcceptedCapsule {
  id: string;
  keyId: string;
  blobId: string;
  count: number;
  expiresMs: number;
  from: { remora: string; owner: string };
}

const packageOf = (network: string) => {
  const id = DEPLOYMENTS[network as "testnet"]?.capsulePackageId ?? null;
  if (!id)
    throw new RemoraError("capsule.unavailable", `Memory capsules aren't on ${network} yet.`);
  return id;
};

export const capsulesOf = (r: { config: unknown }): AcceptedCapsule[] =>
  (r.config as { capsules?: AcceptedCapsule[] }).capsules ?? [];

/** What the owner can lend: the memories a recall finds, with their stored text. */
export async function lendable(deps: RuntimeDeps, r: Remora, query: string) {
  const ns = ["sources", "feedback", "me"].filter((n) =>
    ((r.config as { namespaces?: string[] }).namespaces ?? []).includes(n),
  );
  const hits = await deps.memory.recall(r, query.slice(0, 200) || "what I learned", ns, 10);
  return hits.map((h) => ({ blobId: h.blobId, namespace: h.namespace, text: h.text }));
}

/** `@slug` (a remora on sale) or a remora's own address, never the lender itself. */
async function granteeOf(
  deps: Pick<RuntimeDeps, "db">,
  listings: Listings | undefined,
  r: Remora,
  to: string,
) {
  const t = to.trim();
  let row: Remora | undefined;
  if (t.startsWith("@")) {
    const l = listings?.bySlug(r.network, t.slice(1).toLowerCase());
    if (l?.kind === "remora")
      [row] = await deps.db.select().from(remoras).where(eq(remoras.id, l.sellerId));
  } else if (/^0x[0-9a-fA-F]{1,64}$/.test(t)) {
    [row] = await deps.db
      .select()
      .from(remoras)
      .where(eq(remoras.address, normalizeSuiAddress(t)));
  }
  if (!row || row.status === "retired")
    throw new RemoraError("capsule.grantee", `${t} isn't a live remora here.`);
  if (row.id === r.id) throw new RemoraError("capsule.grantee", "A remora can't lend to itself.");
  return row;
}

/** Step 1: encrypt, store on Walrus, and return the owner's `create` transaction. */
export async function grantTx(
  deps: RuntimeDeps,
  listings: Listings | undefined,
  r: Remora,
  input: { query: string; blobIds: string[]; to: string; days: number },
) {
  const pkg = packageOf(r.network);
  const days = Math.round(input.days);
  if (!(days >= 1 && days <= CAPSULE_LIMITS.days))
    throw new RemoraError("capsule.days", `Lend for 1 to ${CAPSULE_LIMITS.days} days.`);
  const want = [...new Set(input.blobIds)].slice(0, CAPSULE_LIMITS.memories);
  if (!want.length) throw new RemoraError("capsule.empty", "Pick at least one memory to lend.");
  const grantee = await granteeOf(deps, listings, r, input.to);
  // The text comes from the store again, never from the page.
  const found = await lendable(deps, r, input.query);
  const memories = want.map((b) => found.find((m) => m.blobId === b));
  if (memories.some((m) => !m))
    throw new RemoraError(
      "capsule.memory",
      "A memory you picked isn't there anymore; search again.",
    );
  const sui = deps.networks.client(r.network);
  const { keyId, ciphertext } = await encryptCapsule(sui, pkg, {
    v: 1,
    from: { remora: r.name, owner: r.ownerAddress },
    memories: memories.map((m) => m as NonNullable<typeof m>),
  });
  const blobId = await storeOnWalrus(ciphertext, days + 1, deps.fetch);
  const expiresMs = Date.now() + days * DAY_MS;
  const tx = new Transaction();
  tx.setSender(r.ownerAddress);
  tx.moveCall({
    target: `${pkg}::capsule::create`,
    arguments: [
      tx.pure.address(grantee.address),
      tx.pure.vector("u8", Array.from(keyId)),
      tx.pure.string(blobId),
      tx.pure.u64(memories.length),
      tx.pure.u64(expiresMs),
      tx.object.clock(),
    ],
  });
  return {
    transaction: await tx.toJSON(),
    draft: {
      keyId: toHex(keyId),
      blobId,
      count: memories.length,
      expiresMs,
      granteeId: grantee.id,
      granteeName: grantee.name,
    },
  };
}

/** Step 2: the signed `create` landed; the lender's feed records it and the grantee is offered it. */
export async function confirmGrant(
  deps: RuntimeDeps,
  r: Remora,
  digest: string,
  draft: { keyId: string; blobId: string; count: number; expiresMs: number; granteeId: string },
) {
  const res = await deps.networks.client(r.network).core.getTransaction({
    digest,
    include: { effects: true, objectTypes: true, transaction: true },
  });
  const tx = res.Transaction ?? res.FailedTransaction;
  if (!tx.effects?.status.success) throw new RemoraError("tx.failed", "That transaction failed.");
  if (normalizeSuiAddress(tx.transaction?.sender ?? "") !== normalizeSuiAddress(r.ownerAddress))
    throw new RemoraError("tx.not_owner", "That transaction wasn't sent by the owner.", 403);
  const capsuleId = tx.effects.changedObjects.find(
    (o) =>
      o.idOperation === "Created" &&
      (tx.objectTypes?.[o.objectId] ?? "").endsWith("::capsule::Capsule"),
  )?.objectId;
  if (!capsuleId) throw new RemoraError("tx.not_capsule", "That transaction made no capsule.");
  const [g] = await deps.db.select().from(remoras).where(eq(remoras.id, draft.granteeId));
  if (!g) throw new RemoraError("capsule.grantee", "The remora it was lent to is gone.");
  const until = new Date(draft.expiresMs).toISOString().slice(0, 10);
  const capsule = { capsuleId, ...draft, digest, to: g.name };
  await deps.db.insert(remoraEvents).values([
    {
      remoraId: r.id,
      network: r.network,
      type: "action",
      summary: `Lent ${draft.count} memories to ${g.name} until ${until}.`,
      payload: { kind: "capsule_granted", ...capsule },
    },
    {
      remoraId: g.id,
      network: g.network,
      type: "action",
      summary: `Offered: ${draft.count} memories from ${r.name} until ${until}.`,
      payload: {
        kind: "capsule_offered",
        capsuleId,
        keyId: draft.keyId,
        blobId: draft.blobId,
        count: draft.count,
        expiresMs: draft.expiresMs,
        from: { remora: r.name, owner: r.ownerAddress },
      },
    },
  ]);
  await deps.notifier
    .send(g.ownerAddress, {
      text: `${r.name} offers ${g.name} ${draft.count} of its memories until ${until}. Accept?`,
      buttons: [{ label: "Review", url: `${deps.webBase}/remoras/${g.id}?tab=learning` }],
    })
    .catch(() => {});
  return { capsuleId, digest };
}

/** The grantee's owner accepts: nothing reaches its turns before this. */
export async function acceptCapsule(deps: RuntimeDeps, g: Remora, capsuleId: string) {
  const [offer] = await deps.db
    .select()
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, g.id),
        sql`${remoraEvents.payload}->>'kind' = 'capsule_offered'`,
        sql`${remoraEvents.payload}->>'capsuleId' = ${capsuleId}`,
      ),
    )
    .limit(1);
  if (!offer) throw new RemoraError("capsule.not_offered", "No such offer.", 404);
  const p = offer.payload as Omit<AcceptedCapsule, "id"> & { capsuleId: string };
  const accepted: AcceptedCapsule = {
    id: capsuleId,
    keyId: p.keyId,
    blobId: p.blobId,
    count: p.count,
    expiresMs: p.expiresMs,
    from: p.from,
  };
  return saveConfig(
    deps.db,
    g.id,
    (c) => ({
      ...c,
      capsules: [...capsulesOf({ config: c }).filter((x) => x.id !== capsuleId), accepted],
    }),
    { summary: () => `${g.name} accepted ${p.count} memories from ${p.from.remora}.` },
  );
}

/** The lender's `revoke`, one signature; the confirm records it. */
export async function revokeTx(r: Remora, capsuleId: string) {
  const pkg = packageOf(r.network);
  const tx = new Transaction();
  tx.setSender(r.ownerAddress);
  tx.moveCall({ target: `${pkg}::capsule::revoke`, arguments: [tx.object(capsuleId)] });
  return { transaction: await tx.toJSON() };
}

export async function confirmRevoke(
  deps: RuntimeDeps,
  r: Remora,
  capsuleId: string,
  digest: string,
) {
  const res = await deps.networks.client(r.network).core.getTransaction({
    digest,
    include: { effects: true, transaction: true },
  });
  const tx = res.Transaction ?? res.FailedTransaction;
  if (!tx.effects?.status.success) throw new RemoraError("tx.failed", "That transaction failed.");
  if (normalizeSuiAddress(tx.transaction?.sender ?? "") !== normalizeSuiAddress(r.ownerAddress))
    throw new RemoraError("tx.not_owner", "That transaction wasn't sent by the owner.", 403);
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary: "Took back a memory capsule.",
    payload: { kind: "capsule_revoked", capsuleId, digest },
  });
  return { capsuleId, digest };
}

/** What the remora page shows: what it lent, what it was offered, what it reads. */
export async function capsuleView(deps: Pick<RuntimeDeps, "db">, r: Remora) {
  const rows = await deps.db
    .select()
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, r.id),
        sql`${remoraEvents.payload}->>'kind' in ('capsule_granted', 'capsule_offered', 'capsule_revoked')`,
      ),
    )
    .orderBy(desc(remoraEvents.createdAt))
    .limit(50);
  const revoked = new Set(
    rows
      .filter((e) => (e.payload as { kind: string }).kind === "capsule_revoked")
      .map((e) => (e.payload as { capsuleId: string }).capsuleId),
  );
  const accepted = new Set(capsulesOf(r).map((c) => c.id));
  const of = (kind: string) =>
    rows
      .filter((e) => (e.payload as { kind: string }).kind === kind)
      .map((e) => ({
        ...(e.payload as Record<string, unknown> & { capsuleId: string }),
        at: e.createdAt.toISOString(),
      }));
  return {
    lent: of("capsule_granted").map((x) => ({
      ...x,
      revoked: revoked.has(String(x.capsuleId)),
    })),
    offered: of("capsule_offered").filter((x) => !accepted.has(String(x.capsuleId))),
    reading: capsulesOf(r),
  };
}

/** In-process ciphertext cache: blobs don't change, keys are asked for every turn. */
const ciphertexts = new Map<string, Uint8Array>();

export interface CapsuleRead {
  id: string;
  from: string;
  ok: boolean;
  reason?: string;
}

/**
 * At answer time: each accepted capsule's memories, decrypted with the remora's own key. A revoked or
 * expired capsule is refused by the key servers, and the turn says so.
 */
export async function capsuleData(
  deps: RuntimeDeps,
  r: Remora,
  keyId: string,
): Promise<{ data: UntrustedData[]; reads: CapsuleRead[] }> {
  const data: UntrustedData[] = [];
  const reads: CapsuleRead[] = [];
  const caps = capsulesOf(r);
  if (!caps.length) return { data, reads };
  const pkg = DEPLOYMENTS[r.network as "testnet"]?.capsulePackageId;
  if (!pkg) return { data, reads };
  for (const c of caps) {
    const from = `@${c.from.remora}`;
    if (Date.now() >= c.expiresMs) {
      reads.push({ id: c.id, from, ok: false, reason: "expired" });
      continue;
    }
    try {
      let bytes = ciphertexts.get(c.blobId);
      if (!bytes) {
        bytes = await readFromWalrus(c.blobId, deps.fetch);
        ciphertexts.set(c.blobId, bytes);
      }
      const plain = await decryptCapsule({
        sui: deps.networks.client(r.network),
        packageId: pkg,
        capsuleId: c.id,
        keyId: c.keyId,
        grantee: r.address,
        ciphertext: bytes,
        signPersonalMessage: (m) => deps.signer.signPersonalMessage(keyId, m),
      });
      data.push({
        source: `capsule from ${c.from.remora}`,
        content: plain.memories.map((m) => m.text).join("\n"),
      });
      reads.push({ id: c.id, from, ok: true });
    } catch (err) {
      const msg = (err as Error).message;
      reads.push({
        id: c.id,
        from,
        ok: false,
        reason: /access|NoAccess|denied/i.test(msg)
          ? "revoked or expired: the key servers refused"
          : msg.slice(0, 120),
      });
    }
  }
  return { data, reads };
}
