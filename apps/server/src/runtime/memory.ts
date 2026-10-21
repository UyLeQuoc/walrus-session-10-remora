/**
 * F1/A3 (ADR-0030): a remora's memory, in namespaces of the operator's Walrus Memory account.
 * `me` is shared by the owner's remoras; everything else is the remora's own. Writes go through the
 * port, which redacts credentials first (I5/F11a) and settles in the background (~24 s).
 *
 * F4 (ADR-0048): with an index, every write is recorded locally (hash, then blob), and recall and
 * dedupe skip what the owner hid or corrected. Nothing on Walrus can be deleted or edited, so those
 * controls are ours.
 */

import type { Logger } from "@remora/chain";
import {
  createMemoryPort,
  type MemoryPort,
  type MemoryType,
  type WriteEvent,
} from "@remora/memory";

export interface RemoraRef {
  id: string;
  name: string;
  ownerAddress: string;
}

export interface Recalled {
  blobId: string;
  namespace: string;
  text: string;
  distance: number;
}

export interface RemoraMemory {
  recall(r: RemoraRef, query: string, namespaces: string[], limit?: number): Promise<Recalled[]>;
  remember(
    r: RemoraRef,
    ns: string,
    type: MemoryType,
    text: string,
    opts?: { replaces?: string },
  ): Promise<{ saved: boolean; note: string; indexId?: string }>;
}

/** The local index behind F4/F8: where writes are recorded and what recall must skip. */
export interface MemoryIndex {
  onWrite(r: RemoraRef, ns: string, e: WriteEvent): Promise<string | undefined>;
  /** Blob ids the owner hid, or that a correction superseded. */
  skipped(r: RemoraRef): Promise<string[]>;
}

/** Public on chain: ids only, never names or handles (packages/schema NAMESPACES). */
export const namespaceFor = (r: RemoraRef, ns: string) =>
  ns === "me" ? `owner:${r.ownerAddress.toLowerCase()}:me` : `remora:${r.id}:${ns}`;

export function createRemoraMemory(
  operator: { key: string; accountId: string; serverUrl: string },
  log: Logger,
  index?: MemoryIndex,
): RemoraMemory {
  const ports = new Map<string, MemoryPort>();
  /** One live set per remora, refilled before each call; the ports read it by reference. */
  const skips = new Map<string, Set<string>>();
  const skipSet = (r: RemoraRef) => {
    let s = skips.get(r.id);
    if (!s) {
      s = new Set();
      skips.set(r.id, s);
    }
    return s;
  };
  const refresh = async (r: RemoraRef) => {
    if (!index) return;
    const ids = await index.skipped(r).catch((err) => {
      log.warn("memory.skips_failed", { remora: r.id, error: err });
      return null;
    });
    if (!ids) return;
    const s = skipSet(r);
    s.clear();
    for (const id of ids) s.add(id);
  };
  const port = (r: RemoraRef, ns: string) => {
    const namespace = namespaceFor(r, ns);
    let p = ports.get(namespace);
    if (!p) {
      p = createMemoryPort({
        scope: { mode: "guest", ...operator, namespace },
        by: r.name,
        channel: "remora",
        hidden: skipSet(r),
        ...(index
          ? {
              onWrite: (e: WriteEvent) =>
                index.onWrite(r, ns, e).catch((err) => {
                  log.warn("memory.index_failed", { remora: r.id, ns, error: err });
                  return undefined;
                }),
            }
          : {}),
      });
      ports.set(namespace, p);
    }
    return p;
  };
  return {
    async recall(r, query, namespaces, limit = 5) {
      await refresh(r);
      const out: Recalled[] = [];
      for (const ns of namespaces) {
        try {
          const hits = await port(r, ns).recall({ query: query.slice(0, 300), limit });
          out.push(
            ...hits.map((h) => ({
              blobId: h.blob_id,
              namespace: ns,
              text: h.text,
              distance: h.distance,
            })),
          );
        } catch (err) {
          log.warn("memory.recall_failed", { remora: r.id, ns, error: err });
        }
      }
      return out.sort((a, b) => a.distance - b.distance).slice(0, limit * 2);
    },
    async remember(r, ns, type, text, opts) {
      await refresh(r);
      const res = await port(r, ns).remember({
        type,
        text,
        channel: "remora",
        ...(opts?.replaces ? { replaces: opts.replaces } : {}),
      });
      return {
        saved: res.saved,
        note: res.note,
        ...(typeof res.indexId === "string" ? { indexId: res.indexId } : {}),
      };
    },
  };
}
