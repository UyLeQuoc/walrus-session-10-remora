/**
 * F3·be inspector + F6 index check for a remora's namespaces (ADR-0030): what's stored, when it
 * expires, and whether recent writes landed. Text comes only from recall (the read API has metadata).
 */
import { type MemoryMeta, RelayerExtras } from "@remora/memory";
import { namespaceFor, type RemoraRef } from "./memory.ts";

export interface InspectorRow {
  namespace: string;
  blobId: string;
  createdAt: string;
  expiresAt: string | null;
  status: "active" | "expired";
  size: number;
}

export async function inspect(
  operator: { key: string; accountId: string; serverUrl: string },
  r: RemoraRef,
  namespaces: string[],
): Promise<{ rows: InspectorRow[]; counts: Record<string, number> }> {
  const extras = new RelayerExtras(operator);
  const names = new Map(namespaces.map((ns) => [namespaceFor(r, ns), ns]));
  const counts: Record<string, number> = {};
  for (const [full, ns] of names) {
    counts[ns] = await extras.stats(full).then(
      (s) => s.memory_count,
      () => 0,
    );
  }
  const all: MemoryMeta[] = await extras.allMemories().catch(() => []);
  const rows = all
    .filter((m) => names.has(m.namespace_id))
    .map((m) => ({
      namespace: names.get(m.namespace_id) ?? m.namespace_id,
      blobId: m.blob_id,
      createdAt: m.created_at,
      expiresAt: m.expires_at,
      status: m.status,
      size: m.size,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { rows, counts };
}
