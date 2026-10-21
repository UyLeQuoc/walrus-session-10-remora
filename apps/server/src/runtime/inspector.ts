/**
 * F3·be inspector + F6 index check for a remora's namespaces (ADR-0030): what's stored, when it
 * expires, and whether recent writes landed. Text comes only from recall (the read API has metadata).
 *
 * The read API lists the whole operator account, page by page, against the account's hourly budget,
 * so the listing is shared across requests, and a failed read is an error, never an empty list that
 * looks like "nothing stored" (ADR-0049).
 */
import { type MemoryMeta, RelayerExtras } from "@remora/memory";
import { namespaceFor, type RemoraRef } from "./memory.ts";
import { RemoraError } from "./remoras.ts";

export interface InspectorRow {
  namespace: string;
  blobId: string;
  createdAt: string;
  expiresAt: string | null;
  status: "active" | "expired";
  size: number;
}

type Operator = { key: string; accountId: string; serverUrl: string };

const listings = new Map<string, { at: number; rows: Promise<MemoryMeta[]> }>();

/**
 * The account's memories, shared across requests for up to `maxAgeMs` (the relayer allows about
 * 1000 weighted requests an hour per account, and a listing is several pages, ADR-0049). A failure
 * isn't cached and is retried once.
 */
export function listAccount(
  operator: Operator,
  opts: { maxAgeMs?: number; now?: number; list?: () => Promise<MemoryMeta[]> } = {},
): Promise<MemoryMeta[]> {
  const now = opts.now ?? Date.now();
  const cached = listings.get(operator.accountId);
  if (cached && now - cached.at < (opts.maxAgeMs ?? 30_000)) return cached.rows;
  const list = opts.list ?? (() => new RelayerExtras(operator).allMemories());
  const rows = list()
    .catch(() => list())
    .catch((err) => {
      listings.delete(operator.accountId);
      throw new RemoraError(
        "relayer.slow",
        `Walrus Memory didn't list the memories just now (${(err as Error).message}). Try again in a minute.`,
        409,
      );
    });
  listings.set(operator.accountId, { at: now, rows });
  return rows;
}

export async function inspect(
  operator: Operator,
  r: RemoraRef,
  namespaces: string[],
): Promise<{ rows: InspectorRow[]; counts: Record<string, number> }> {
  const names = new Map(namespaces.map((ns) => [namespaceFor(r, ns), ns]));
  const all = await listAccount(operator);
  const counts: Record<string, number> = {};
  for (const ns of namespaces) counts[ns] = 0;
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
  for (const row of rows) counts[row.namespace] = (counts[row.namespace] ?? 0) + 1;
  return { rows, counts };
}
