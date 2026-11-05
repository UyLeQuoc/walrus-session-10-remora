/**
 * F4, F5, F8 (ADR-0046, ADR-0048): what an owner can do with a remora's memory, honestly.
 * - **Hide** one memory: our own filter on recall and dedupe (the blob stays on Walrus; it can be undone).
 * - **Correct** a fact: a `[correction]` that names the blob it replaces; the old one stops being recalled.
 * - **Forget all** in a namespace: the relayer drops that namespace's index; blobs stay until they expire,
 *   and the facts read from them are retracted (F15).
 * - **Expiry**: from the relayer's read API, flagged under 30 days.
 * - **Export**: metadata always, text when recall returns it, verified against the hash we recorded.
 * - **Duplicates**: a write skipped because it matched a stored memory is shown, never silent (ADR-0086).
 */
import {
  and,
  type Db,
  desc,
  eq,
  inArray,
  isNotNull,
  memoryFacts,
  ne,
  or,
  remoraMemories,
} from "@remora/db";
import { createMemoryPort, type MemoryType, RelayerExtras, type WriteEvent } from "@remora/memory";
import type { InspectorResponse, RemoraMemoryExport } from "@remora/schema";
import { MEMORY_TYPES } from "@remora/schema";
import { recoverText } from "../memory/export.ts";
import type { InspectorRow } from "./inspector.ts";
import { type MemoryIndex, namespaceFor, type RemoraMemory, type RemoraRef } from "./memory.ts";
import { RemoraError } from "./remoras.ts";

const DAY_MS = 86_400_000;
export const EXPIRY_ALERT_DAYS = 30;

/** The DB side of the memory index (F4/F8). */
export function memoryIndexFor(db: Db): MemoryIndex {
  return {
    async onWrite(r, ns, e: WriteEvent) {
      if (e.outcome === "accepted" || e.outcome === "duplicate") {
        const [row] = await db
          .insert(remoraMemories)
          .values({
            remoraId: r.id,
            namespace: ns,
            type: e.type,
            textSha256: e.textSha256,
            jobId: e.jobId,
            blobId: e.blobId,
            status: e.outcome === "duplicate" ? "duplicate" : "pending",
            ...(e.outcome === "duplicate" ? { settledAt: new Date() } : {}),
          })
          .returning({ id: remoraMemories.id });
        return row?.id;
      }
      if (!e.jobId) return undefined;
      await db
        .update(remoraMemories)
        .set({
          blobId: e.blobId,
          status: e.outcome === "stored" ? "stored" : "failed",
          settledAt: new Date(),
        })
        .where(and(eq(remoraMemories.remoraId, r.id), eq(remoraMemories.jobId, e.jobId)));
      return undefined;
    },
    async skipped(r) {
      const rows = await db
        .select({
          blobId: remoraMemories.blobId,
          hiddenAt: remoraMemories.hiddenAt,
          corrects: remoraMemories.corrects,
          status: remoraMemories.status,
        })
        .from(remoraMemories)
        .where(
          and(
            eq(remoraMemories.remoraId, r.id),
            or(isNotNull(remoraMemories.hiddenAt), isNotNull(remoraMemories.corrects)),
          ),
        );
      const out = new Set<string>();
      for (const row of rows) {
        if (row.hiddenAt && row.blobId) out.add(row.blobId);
        // A correction that never landed doesn't supersede anything.
        if (row.corrects && row.status !== "failed") out.add(row.corrects);
      }
      return [...out];
    },
  };
}

const assertNamespace = (namespaces: string[], ns: string) => {
  if (!namespaces.includes(ns))
    throw new RemoraError("memory.bad_namespace", `This remora has no ${ns} memories.`);
};

/** F4: hide (or show again) one memory. Recall and dedupe skip it; the blob stays on Walrus. */
export async function setHidden(
  db: Db,
  r: RemoraRef,
  namespaces: string[],
  input: { blobId: string; namespace: string; hidden: boolean },
) {
  assertNamespace(namespaces, input.namespace);
  const hiddenAt = input.hidden ? new Date() : null;
  const updated = await db
    .update(remoraMemories)
    .set({ hiddenAt })
    .where(and(eq(remoraMemories.remoraId, r.id), eq(remoraMemories.blobId, input.blobId)))
    .returning({ id: remoraMemories.id });
  // Memories written before the index existed get a row the first time they're hidden.
  if (!updated.length && input.hidden) {
    await db.insert(remoraMemories).values({
      remoraId: r.id,
      namespace: input.namespace,
      blobId: input.blobId,
      status: "stored",
      hiddenAt,
    });
  }
  return { blobId: input.blobId, hidden: input.hidden };
}

/** F4: correct a fact. The correction names the blob it replaces, which recall then skips. */
export async function correct(
  db: Db,
  memory: RemoraMemory,
  r: RemoraRef,
  namespaces: string[],
  input: { blobId: string; namespace: string; text: string },
) {
  assertNamespace(namespaces, input.namespace);
  const text = input.text.trim();
  if (!text) throw new RemoraError("memory.empty", "Say what the right fact is.");
  // The owner said it: in the facts ledger it outranks anything a remora or an agent wrote (F15).
  const res = await memory.remember(r, input.namespace, "correction", text.slice(0, 2_000), {
    replaces: input.blobId,
    asserted: "owner",
  });
  if (res.indexId) {
    await db
      .update(remoraMemories)
      .set({ corrects: input.blobId })
      .where(eq(remoraMemories.id, res.indexId));
  } else {
    // A duplicate correction: record the supersession on a row of its own.
    await db.insert(remoraMemories).values({
      remoraId: r.id,
      namespace: input.namespace,
      type: "correction",
      status: "duplicate",
      corrects: input.blobId,
    });
  }
  return { corrects: input.blobId, saved: res.saved, note: res.note };
}

/** F4: forget a whole namespace. The relayer drops its index; the blobs stay until they expire. */
export async function forgetNamespace(
  db: Db,
  operator: { key: string; accountId: string; serverUrl: string },
  r: RemoraRef,
  namespaces: string[],
  ns: string,
) {
  assertNamespace(namespaces, ns);
  if (ns === "me")
    throw new RemoraError(
      "memory.shared",
      "“me” is shared by all your remoras; hide single memories there instead.",
    );
  await new RelayerExtras(operator).forget(namespaceFor(r, ns));
  await db
    .update(remoraMemories)
    .set({ hiddenAt: new Date() })
    .where(and(eq(remoraMemories.remoraId, r.id), eq(remoraMemories.namespace, ns)));
  await db
    .update(memoryFacts)
    .set({ status: "retracted", closedAt: new Date() })
    .where(
      and(eq(memoryFacts.namespace, namespaceFor(r, ns)), ne(memoryFacts.status, "retracted")),
    );
  return {
    namespace: ns,
    note: "Recall no longer finds these memories. Walrus Memory can't delete a stored blob, so they stay encrypted on Walrus until they expire.",
  };
}

/** A0 (ADR-0135): the blobs our index recorded as stored, per namespace, for the index check. */
export async function storedBlobs(db: Db, r: RemoraRef) {
  return db
    .select({ namespace: remoraMemories.namespace, blobId: remoraMemories.blobId })
    .from(remoraMemories)
    .where(
      and(
        eq(remoraMemories.remoraId, r.id),
        eq(remoraMemories.status, "stored"),
        isNotNull(remoraMemories.blobId),
      ),
    );
}

/** F4/F5: inspector rows with the owner's controls and the expiry alert. */
export async function enrichRows(
  db: Db,
  r: RemoraRef,
  rows: InspectorRow[],
  now = Date.now(),
): Promise<InspectorResponse["rows"]> {
  const blobIds = rows.map((x) => x.blobId);
  const local = blobIds.length
    ? await db
        .select()
        .from(remoraMemories)
        .where(and(eq(remoraMemories.remoraId, r.id), inArray(remoraMemories.blobId, blobIds)))
    : [];
  const corrections = await db
    .select({ corrects: remoraMemories.corrects, blobId: remoraMemories.blobId })
    .from(remoraMemories)
    .where(
      and(
        eq(remoraMemories.remoraId, r.id),
        isNotNull(remoraMemories.corrects),
        ne(remoraMemories.status, "failed"),
      ),
    );
  // A duplicate row holds the blob it matched, not one of its own: it counts against that memory
  // and never stands in for it (its type is the skipped write's).
  const byBlob = new Map(local.filter((m) => m.status !== "duplicate").map((m) => [m.blobId, m]));
  const duplicateWrites = new Map<string, number>();
  for (const m of local)
    if (m.status === "duplicate" && m.blobId)
      duplicateWrites.set(m.blobId, (duplicateWrites.get(m.blobId) ?? 0) + 1);
  const supersededBy = new Map(corrections.map((c) => [c.corrects, c.blobId ?? "pending"]));
  return rows.map((row) => {
    const m = byBlob.get(row.blobId);
    const expires = row.expiresAt ? Date.parse(row.expiresAt) : null;
    return {
      ...row,
      type: isMemoryType(m?.type) ? m.type : null,
      hiddenAt: m?.hiddenAt?.toISOString() ?? null,
      supersededBy: supersededBy.get(row.blobId) ?? null,
      expiresSoon:
        row.status === "active" && expires !== null && expires - now < EXPIRY_ALERT_DAYS * DAY_MS,
      duplicateWrites: duplicateWrites.get(row.blobId) ?? 0,
    };
  });
}

/**
 * ADR-0086: the newest writes skipped because they matched a stored memory. Dewee flags
 * near-duplicates for someone to review; ours were dropped without a word, which is how Scout's newer
 * scores were lost (ADR-0074). `blobId` is the memory each one matched.
 */
export async function recentDuplicates(db: Db, r: RemoraRef, limit = 20) {
  const rows = await db
    .select({
      namespace: remoraMemories.namespace,
      type: remoraMemories.type,
      blobId: remoraMemories.blobId,
      at: remoraMemories.createdAt,
    })
    .from(remoraMemories)
    .where(and(eq(remoraMemories.remoraId, r.id), eq(remoraMemories.status, "duplicate")))
    .orderBy(desc(remoraMemories.createdAt))
    .limit(limit);
  return rows.flatMap((d) =>
    d.blobId
      ? [
          {
            namespace: d.namespace,
            type: isMemoryType(d.type) ? d.type : null,
            blobId: d.blobId,
            at: d.at.toISOString(),
          },
        ]
      : [],
  );
}

const isMemoryType = (t: unknown): t is MemoryType =>
  typeof t === "string" && (MEMORY_TYPES as readonly string[]).includes(t);

/** F8: everything we can honestly hand back for one remora. Never stored. */
export async function exportMemories(
  db: Db,
  operator: { key: string; accountId: string; serverUrl: string },
  r: RemoraRef & { network: "testnet" | "mainnet" },
  rows: InspectorResponse["rows"],
  now = new Date(),
): Promise<RemoraMemoryExport> {
  const local = await db
    .select()
    .from(remoraMemories)
    .where(eq(remoraMemories.remoraId, r.id))
    .orderBy(desc(remoraMemories.createdAt));
  const shaByBlob = new Map(local.filter((m) => m.blobId).map((m) => [m.blobId, m.textSha256]));
  const text = new Map<string, { line: string; verified: boolean }>();
  // One raw port per namespace (no hide filter: hidden memories are exported, marked hidden).
  for (const ns of new Set(rows.map((x) => x.namespace))) {
    const port = createMemoryPort({
      scope: { mode: "guest", ...operator, namespace: namespaceFor(r, ns) },
      by: r.name,
      channel: "remora",
    });
    const nsRows = rows
      .filter((x) => x.namespace === ns)
      .map((x) => ({
        blobId: x.blobId,
        type: x.type ?? "unknown",
        status: "stored",
        channel: "remora",
        namespace: ns,
        accountId: operator.accountId,
        createdAt: new Date(x.createdAt),
        textSha256: shaByBlob.get(x.blobId) ?? "",
      }));
    const found = await recoverText(
      async ({ query, limit, maxDistance }) =>
        (await port.recall({ query, limit, maxDistance })).map((h) => ({
          blob_id: h.blob_id,
          text: h.text,
        })),
      nsRows,
    );
    for (const [blob, v] of found) text.set(blob, v);
  }
  return {
    format: "remora.memory-export/v1",
    remora: { id: r.id, name: r.name },
    network: r.network,
    exportedAt: now.toISOString(),
    memories: rows.map((x) => {
      const t = text.get(x.blobId);
      return {
        blobId: x.blobId,
        namespace: x.namespace,
        type: x.type,
        createdAt: new Date(x.createdAt).toISOString(),
        expiresAt: x.expiresAt ? new Date(x.expiresAt).toISOString() : null,
        hidden: !!x.hiddenAt,
        supersededBy: x.supersededBy && x.supersededBy !== "pending" ? x.supersededBy : null,
        text: t?.line ?? null,
        // Only a line that hashes to what we recorded at write time is verified.
        verified: !!t?.verified && !!shaByBlob.get(x.blobId),
      };
    }),
    notes: [
      "Walrus Memory has no per-memory delete: hidden, corrected and forgotten memories stay encrypted on Walrus until they expire.",
      "Text comes back only through recall, so some lines may be missing; “verified” means the text hashes to what the remora wrote.",
      "This file holds the text, not a key to decrypt the blobs yourself.",
    ],
  };
}

/** F8: the same export to read. */
export function exportMarkdown(file: RemoraMemoryExport): string {
  const out = [
    `# ${file.remora.name}'s memory`,
    "",
    `Exported ${file.exportedAt.slice(0, 16).replace("T", " ")} UTC from Remora (${file.network}).`,
    `${file.memories.length} memories, text for ${file.memories.filter((m) => m.text).length}, verified for ${file.memories.filter((m) => m.verified).length}.`,
    "",
    "## What this file can't do",
    "",
    ...file.notes.map((n) => `- ${n}`),
  ];
  for (const ns of new Set(file.memories.map((m) => m.namespace))) {
    out.push("", `## ${ns}`, "");
    for (const m of file.memories.filter((x) => x.namespace === ns)) {
      const flags = [
        m.type ?? "",
        m.hidden ? "hidden" : "",
        m.supersededBy ? `corrected by ${m.supersededBy}` : "",
        m.verified ? "verified" : "",
        m.expiresAt ? `expires ${m.expiresAt.slice(0, 10)}` : "",
      ].filter(Boolean);
      out.push(
        `- ${m.text ?? "_text not recovered_"}  `,
        `  ${m.createdAt.slice(0, 10)} · \`${m.blobId}\`${flags.length ? ` · ${flags.join(" · ")}` : ""}`,
      );
    }
  }
  return `${out.join("\n")}\n`;
}
